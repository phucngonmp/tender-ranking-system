import concurrent.futures
import logging
import re
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup

from app.gebiz.parsers import (
    build_rich_description,
    build_rich_requirements_text,
    parse_gebiz_card,
    parse_gebiz_detail_page,
)
from app.search_config import GEBIZ_CONFIG, GeBizSearchConfig

logger = logging.getLogger("gebiz")

GEBIZ_BASE_URL = "https://www.gebiz.gov.sg/ptn/opportunity/BOListing.xhtml"
GEBIZ_DIRECT_LINK_URL = "https://www.gebiz.gov.sg/ptn/opportunity/directlink.xhtml"

COMMON_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
}
MAX_DETAIL_WORKERS = 5


def _get_initial_session_state(session: requests.Session) -> tuple[BeautifulSoup, str, str]:
    """Fetches the initial BOListing page to retrieve active session cookies, ViewState, and dynamic component prefix."""
    response = session.get(GEBIZ_BASE_URL, headers=COMMON_HEADERS, timeout=25)
    response.raise_for_status()

    soup = BeautifulSoup(response.text, "html.parser")
    view_state_elem = soup.find("input", {"name": "javax.faces.ViewState"})
    if not view_state_elem:
        raise ValueError("Cannot find javax.faces.ViewState in initial GeBIZ response")

    view_state = view_state_elem.get("value", "")

    search_input = soup.find("input", {"name": re.compile(r"searchBar_INPUT-SEARCH")})
    if not search_input:
        raise ValueError("Cannot find searchBar_INPUT-SEARCH in GeBIZ DOM")

    search_input_name = search_input.get("name", "")
    return soup, view_state, search_input_name


def _build_search_payload(
    soup: BeautifulSoup,
    view_state: str,
    search_name: str,
    keyword: str,
    config: GeBizSearchConfig = GEBIZ_CONFIG,
) -> dict:
    """Builds the JSF AJAX form payload with all hidden fields and configured search parameters."""
    prefix_match = re.search(r"(contentForm:j_idt\d+)_searchBar_INPUT-SEARCH", search_name)
    component_prefix = prefix_match.group(1) if prefix_match else "contentForm:j_idt183"

    button_go_name = f"{component_prefix}_searchBar_BUTTON-GO"
    container_name = component_prefix

    post_data = {
        "contentForm": "contentForm",
        search_name: keyword,
        "contentForm:j_id49": config.match_mode,
        "contentForm:j_idt301_selectManyMenu_BUTTON": config.category,
        "contentForm:j_idt306_selectManyMenu_BUTTON": config.agency,
        "contentForm:j_idt311_selectManyMenu_BUTTON": config.procurement_type,
        "contentForm:j_idt799_select": config.opportunity_status,
        "contentForm:j_idt802_select": config.date_range_preset,
        "javax.faces.ViewState": view_state,
        "javax.faces.source": button_go_name,
        "javax.faces.partial.event": "click",
        "javax.faces.partial.execute": f"{button_go_name} {container_name}",
        "javax.faces.partial.render": container_name,
        "javax.faces.behavior.event": "action",
        "javax.faces.partial.ajax": "true",
    }

    # Conditionally add search scope checkboxes
    if config.search_in_title:
        post_data["contentForm:j_id48_0"] = "Title"
    if config.search_in_doc_no:
        post_data["contentForm:j_id48_1"] = "Document No."
    if config.search_in_agency:
        post_data["contentForm:j_id48_2"] = "Agency"

    for input_tag in soup.find_all("input", {"type": "hidden"}):
        input_name = input_tag.get("name")
        if input_name and input_name not in post_data:
            post_data[input_name] = input_tag.get("value", "")

    return post_data


def _execute_search_and_fetch_html(session: requests.Session, payload: dict) -> str:
    """Submits the search AJAX request and follows the JSF redirect to obtain the result HTML."""
    ajax_headers = {
        **COMMON_HEADERS,
        "Accept": "application/xml, text/xml, */*; q=0.01",
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        "Faces-Request": "partial/ajax",
        "Origin": "https://www.gebiz.gov.sg",
        "Referer": GEBIZ_BASE_URL,
        "X-Requested-With": "XMLHttpRequest",
    }

    response = session.post(GEBIZ_BASE_URL, headers=ajax_headers, data=payload, timeout=25)
    response.raise_for_status()

    redirect_match = re.search(r'<redirect url="([^"]+)"', response.text)
    if redirect_match:
        redirect_url = urljoin(GEBIZ_BASE_URL, redirect_match.group(1))
        result_response = session.get(redirect_url, headers=COMMON_HEADERS, timeout=25)
        result_response.raise_for_status()
        return result_response.text

    return response.text


def _parse_tenders_from_html(html: str) -> list[dict]:
    """Extracts unique tender items from the result page HTML."""
    soup = BeautifulSoup(html, "html.parser")
    tender_links = soup.find_all("a", class_="commandLink_TITLE-BLUE")
    if not tender_links:
        tender_links = soup.find_all("a", href=lambda h: h and "docCode=" in h)

    results: list[dict] = []
    seen_codes: set[str] = set()

    for a_tag in tender_links:
        href = a_tag.get("href", "")
        code_match = re.search(r"docCode=([A-Z0-9]+)", href)
        doc_code = code_match.group(1) if code_match else ""
        if not doc_code or doc_code in seen_codes:
            continue
        seen_codes.add(doc_code)

        card_container = a_tag.find_parent("div", class_=lambda c: c and "formColumns_ROW-TABLE" in str(c))
        full_card = card_container.parent if card_container else a_tag.parent

        item = parse_gebiz_card(full_card, GEBIZ_BASE_URL)
        if item:
            results.append(item)

    return results


def fetch_gebiz_detail(doc_code: str) -> dict:
    """Fetches the opportunity detail page for a specific tender and extracts deep metadata."""
    detail_url = f"{GEBIZ_DIRECT_LINK_URL}?docCode={doc_code}"
    try:
        response = requests.get(detail_url, headers=COMMON_HEADERS, timeout=25, allow_redirects=True)
        if response.status_code == 200:
            return parse_gebiz_detail_page(response.text)
    except Exception as exc:
        logger.warning(f"[GeBIZ] Failed to fetch detail for {doc_code}: {exc}")
    return {}


def _enrich_tender_with_details(item: dict) -> dict:
    """Enriches a single raw tender item with deep metadata from its opportunity detail page."""
    doc_code = item.get("external_code")
    if not doc_code:
        return item

    detail_data = fetch_gebiz_detail(doc_code)
    if detail_data:
        item["description"] = build_rich_description(item.get("description", ""), detail_data)
        item["requirements_text"] = build_rich_requirements_text(item.get("requirements_text", ""), detail_data)
        if detail_data.get("gra_estimated_value") is not None:
            item["estimated_value"] = detail_data["gra_estimated_value"]

    return item


def search_gebiz(keyword: str, config: GeBizSearchConfig = GEBIZ_CONFIG) -> list[dict]:
    """Main crawler entry point for GeBIZ Singapore keyword search.
    Enriches all tender items with full detail metadata and returns a list conforming to RawTenderItem.
    """
    logger.info(f"[GeBIZ] Starting search for keyword: '{keyword}' with config: {config}")
    session = requests.Session()

    soup, view_state, search_name = _get_initial_session_state(session)
    payload = _build_search_payload(soup, view_state, search_name, keyword, config=config)
    result_html = _execute_search_and_fetch_html(session, payload)
    raw_items = _parse_tenders_from_html(result_html)

    # Filter items by allowed opportunity types (TQ = Quotation, TT = Tender, TL = Tender Lite)
    if config.opportunity_types:
        filtered_items = []
        for item in raw_items:
            doc_code = item.get("external_code", "").upper()
            desc = item.get("description", "").upper()
            is_matched = False
            if "TQ" in config.opportunity_types and ("ETQ" in doc_code or "QUOTATION" in desc):
                is_matched = True
            elif "TL" in config.opportunity_types and ("ETL" in doc_code or "TENDER LITE" in desc):
                is_matched = True
            elif "TT" in config.opportunity_types and ("ETT" in doc_code or "TENDER" in desc):
                is_matched = True
            
            if is_matched or not ("ETQ" in doc_code or "ETL" in doc_code or "ETT" in doc_code):
                filtered_items.append(item)
        raw_items = filtered_items

    logger.info(f"[GeBIZ] Found {len(raw_items)} matching tenders for '{keyword}'. Fetching detail pages...")

    # Fetch detail pages in parallel
    enriched_items = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=config.max_detail_workers) as executor:
        futures = [executor.submit(_enrich_tender_with_details, item) for item in raw_items]
        for future in concurrent.futures.as_completed(futures):
            try:
                enriched_items.append(future.result())
            except Exception as exc:
                logger.warning(f"[GeBIZ] Error enriching tender item: {exc}")

    logger.info(f"[GeBIZ] Successfully enriched {len(enriched_items)} tenders for '{keyword}'")
    return enriched_items
