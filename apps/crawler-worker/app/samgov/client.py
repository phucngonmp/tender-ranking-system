"""
Client for SAM.gov (System for Award Management) Contract Opportunities.

Searches active US Federal contracting opportunities via the SAM.gov internal REST API:
- Enforces is_active=true (Active notices only).
- Enforces qMode=EXACT and exact phrase keyword wrapping (\"keyword\").
- Extracts total pages from API metadata (page.totalPages).
- Concurrently fetches search result pages using ThreadPoolExecutor.
- Concurrently fetches opportunity full details and Statement of Work.
- Normalizes all data using app.samgov.parsers.parse_samgov_opportunity.
"""

import concurrent.futures
import logging
import random
import time
from typing import Any

import httpx

from app.samgov.parsers import parse_samgov_opportunity

logger = logging.getLogger("samgov")

BASE_API_URL = "https://sam.gov/api/prod"
SEARCH_ENDPOINT = f"{BASE_API_URL}/sgs/v1/search/"
DETAIL_ENDPOINT = f"{BASE_API_URL}/opps/v2/opportunities"

REQUEST_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36"
    ),
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "en-US,en;q=0.9",
    "Referer": "https://sam.gov/search/?index=ac&sfm%5Bstatus%5D%5Bis_active%5D=true",
}

PAGE_FETCH_WORKERS = 5
DETAIL_FETCH_WORKERS = 8
PAGE_SIZE = 25
MAX_PAGES_LIMIT = 20
REQUEST_TIMEOUT = 25.0


def _build_search_params(keyword: str, page: int) -> dict[str, str]:
    """Constructs strict exact-match, active-only search parameters."""
    clean_kw = keyword.strip()
    if not (clean_kw.startswith('"') and clean_kw.endswith('"')):
        exact_query = f'"{clean_kw}"'
    else:
        exact_query = clean_kw

    return {
        "index": "ac",
        "domain": "ac",
        "page": str(page),
        "size": str(PAGE_SIZE),
        "sort": "-modifiedDate",
        "mode": "search",
        "responseType": "json",
        "q": exact_query,
        "qMode": "EXACT",
        "is_active": "true",
        "random": str(int(time.time() * 1000)),
    }


def _fetch_search_page(client: httpx.Client, keyword: str, page: int) -> tuple[list[dict[str, Any]], int]:
    """Fetches a single search page, returning (results_list, total_pages)."""
    params = _build_search_params(keyword, page)
    retries = 2
    for attempt in range(retries + 1):
        try:
            response = client.get(
                SEARCH_ENDPOINT,
                params=params,
                headers=REQUEST_HEADERS,
                timeout=REQUEST_TIMEOUT,
            )
            if response.status_code == 200:
                data = response.json()
                page_info = data.get("page", {})
                total_pages = int(page_info.get("totalPages", 1))
                results = data.get("_embedded", {}).get("results", [])
                return results, total_pages

            if response.status_code == 429:
                sleep_time = 1.5 * (attempt + 1)
                logger.warning(f"[SAM.gov] Rate limited (429) on page {page}, retrying in {sleep_time:.1f}s...")
                time.sleep(sleep_time)
                continue

            logger.warning(f"[SAM.gov] HTTP {response.status_code} fetching page {page}: {response.text[:200]}")
            if attempt < retries:
                time.sleep(1.0)
        except Exception as exc:
            logger.warning(f"[SAM.gov] Exception fetching page {page} (attempt {attempt + 1}/{retries + 1}): {exc}")
            if attempt < retries:
                time.sleep(1.0)

    return [], 1


def _collect_all_opportunity_items(keyword: str) -> list[dict[str, Any]]:
    """Fetches page 0, checks total pages, and concurrently collects all opportunity summary records."""
    logger.info(f"[SAM.gov] Fetching initial search page (Page 0) for keyword: '{keyword}'...")

    with httpx.Client(timeout=REQUEST_TIMEOUT) as client:
        page_0_results, total_pages = _fetch_search_page(client, keyword, page=0)

        effective_total_pages = min(max(total_pages, 1), MAX_PAGES_LIMIT)
        logger.info(
            f"[SAM.gov] Found {total_pages} total pages (capped at {effective_total_pages}) for keyword '{keyword}'. "
            f"Page 0 returned {len(page_0_results)} items."
        )

        all_items: list[dict[str, Any]] = list(page_0_results)
        seen_ids: set[str] = {item["_id"] for item in page_0_results if item.get("_id")}

        if effective_total_pages <= 1:
            return all_items

        remaining_pages = list(range(1, effective_total_pages))
        logger.info(
            f"[SAM.gov] Concurrently fetching {len(remaining_pages)} remaining pages "
            f"(Pages 1 to {effective_total_pages - 1}) with {PAGE_FETCH_WORKERS} workers..."
        )

        def fetch_page_worker(p: int) -> list[dict[str, Any]]:
            time.sleep(random.uniform(0.1, 0.3))
            with httpx.Client(timeout=REQUEST_TIMEOUT) as worker_client:
                results, _ = _fetch_search_page(worker_client, keyword, page=p)
                return results

        with concurrent.futures.ThreadPoolExecutor(max_workers=PAGE_FETCH_WORKERS) as executor:
            future_to_page = {executor.submit(fetch_page_worker, p): p for p in remaining_pages}
            for future in concurrent.futures.as_completed(future_to_page):
                page_idx = future_to_page[future]
                try:
                    results = future.result()
                    new_items = []
                    for it in results:
                        opp_id = it.get("_id")
                        if opp_id and opp_id not in seen_ids:
                            seen_ids.add(opp_id)
                            new_items.append(it)
                    all_items.extend(new_items)
                    logger.info(f"[SAM.gov] Page {page_idx}: added {len(new_items)} new opportunities.")
                except Exception as exc:
                    logger.warning(f"[SAM.gov] Error processing search page {page_idx}: {exc}")

        logger.info(f"[SAM.gov] Total unique opportunities collected across pages: {len(all_items)}")
        return all_items


def _fetch_opportunity_detail(opp_id: str) -> dict[str, Any]:
    """Fetches full opportunity detail payload from SAM.gov opportunities API."""
    detail_url = f"{DETAIL_ENDPOINT}/{opp_id}"
    params = {
        "api_key": "null",
        "random": str(int(time.time() * 1000)),
    }
    retries = 2
    for attempt in range(retries + 1):
        try:
            with httpx.Client(timeout=REQUEST_TIMEOUT) as client:
                response = client.get(
                    detail_url,
                    params=params,
                    headers=REQUEST_HEADERS,
                )
                if response.status_code == 200:
                    return response.json()

                if response.status_code == 429:
                    time.sleep(1.5 * (attempt + 1))
                    continue

                logger.warning(f"[SAM.gov] Detail HTTP {response.status_code} for opportunity {opp_id}")
                if attempt < retries:
                    time.sleep(1.0)
        except Exception as exc:
            logger.warning(f"[SAM.gov] Error fetching detail for {opp_id} (attempt {attempt + 1}): {exc}")
            if attempt < retries:
                time.sleep(1.0)

    return {}


def _fetch_details_and_parse(summary_items: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Concurrently fetches details for each opportunity and normalizes into standard tender objects."""
    total = len(summary_items)
    logger.info(f"[SAM.gov] Fetching details for {total} opportunities with {DETAIL_FETCH_WORKERS} workers...")

    results: list[dict[str, Any]] = []

    def process_item(item: dict[str, Any]) -> dict[str, Any] | None:
        opp_id = item.get("_id")
        if not opp_id:
            return None
        time.sleep(random.uniform(0.1, 0.25))
        detail_json = _fetch_opportunity_detail(opp_id)
        return parse_samgov_opportunity(item, detail_json)

    with concurrent.futures.ThreadPoolExecutor(max_workers=DETAIL_FETCH_WORKERS) as executor:
        future_to_item = {executor.submit(process_item, it): it for it in summary_items}
        for idx, future in enumerate(concurrent.futures.as_completed(future_to_item), start=1):
            try:
                tender_obj = future.result()
                if tender_obj:
                    results.append(tender_obj)
                if idx % 10 == 0 or idx == total:
                    logger.info(f"[SAM.gov] Progress: parsed {idx}/{total} opportunity details...")
            except Exception as exc:
                logger.warning(f"[SAM.gov] Error parsing opportunity item: {exc}")

    logger.info(f"[SAM.gov] Finished fetching details: successfully normalized {len(results)}/{total} opportunities.")
    return results


def search_samgov(keyword: str) -> list[dict[str, Any]]:
    """
    Main entry point for SAM.gov search.
    Searches active contract opportunities using exact phrase matching across all pages,
    fetches rich details, and returns standard tender dictionary records.
    """
    logger.info(f"[SAM.gov] Starting crawl for keyword: '{keyword}' (active notices only, exact phrase)")
    summary_items = _collect_all_opportunity_items(keyword)
    if not summary_items:
        logger.info(f"[SAM.gov] No opportunities found for keyword '{keyword}'")
        return []

    return _fetch_details_and_parse(summary_items)
