"""
Parsers for SAM.gov (System for Award Management) Contract Opportunities.

Normalizes raw opportunity search items and detail payloads into
the standardized tender schema used across the ranking platform.
"""

import json
import logging
import re
from typing import Any

logger = logging.getLogger("samgov")

SAMGOV_SCHEMA_FORMAT = "samgov_v1"


def _clean_html_to_text(html_text: str | None) -> str:
    """Strips HTML tags while preserving paragraphs, headings, and lists."""
    if not html_text or not html_text.strip():
        return ""

    text = html_text.strip()
    # Normalize break tags and paragraph ends
    text = re.sub(r"<br\s*/?>", "\n", text, flags=re.IGNORECASE)
    text = re.sub(r"</p>", "\n\n", text, flags=re.IGNORECASE)
    text = re.sub(r"</li>", "\n", text, flags=re.IGNORECASE)
    text = re.sub(r"<li[^>]*>", "• ", text, flags=re.IGNORECASE)
    text = re.sub(r"</h[1-6]>", "\n\n", text, flags=re.IGNORECASE)

    # Strip remaining tags
    text = re.sub(r"<[^>]+>", " ", text)

    # Unescape common HTML entities
    text = (
        text.replace("&nbsp;", " ")
        .replace("&amp;", "&")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&quot;", '"')
        .replace("&apos;", "'")
        .replace("&#39;", "'")
        .replace("&rsquo;", "'")
        .replace("&ldquo;", '"')
        .replace("&rdquo;", '"')
        .replace("&ndash;", "-")
        .replace("&mdash;", "-")
    )

    # Normalize whitespace
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def _format_investor(org_hierarchy: list[dict[str, Any]]) -> str:
    """Formats Department - Agency - Office hierarchy into clean procuring organization name."""
    if not org_hierarchy:
        return "US Federal Government"

    dept_name: str | None = None
    agency_name: str | None = None
    office_name: str | None = None

    for org in org_hierarchy:
        org_type = str(org.get("type", "")).upper()
        name = org.get("name")
        if not name:
            continue
        if org_type == "DEPARTMENT":
            dept_name = name
        elif org_type in ["AGENCY", "MAJOR COMMAND"]:
            agency_name = name
        elif org_type == "OFFICE":
            office_name = name

    parts = [p for p in [dept_name, agency_name, office_name] if p]
    if parts:
        return " - ".join(parts)
    return dept_name or agency_name or "US Federal Government"


def _extract_locality(place_of_performance: dict[str, Any] | None) -> str:
    """Extracts City, State, Country from placeOfPerformance object."""
    if not place_of_performance:
        return "USA"

    pop = place_of_performance
    city_val = pop.get("city")
    city = city_val.get("name") if isinstance(city_val, dict) else city_val

    state_val = pop.get("state")
    state = (
        state_val.get("name") or state_val.get("code")
        if isinstance(state_val, dict)
        else state_val
    )

    if city and state:
        return f"{city}, {state}, USA"
    if state:
        return f"{state}, USA"
    if city:
        return f"{city}, USA"
    return "USA"


def _extract_primary_naics(naics_list: list[dict[str, Any]] | None) -> str | None:
    """Extracts primary NAICS code from naics list."""
    if not naics_list or not isinstance(naics_list, list):
        return None

    for item in naics_list:
        if isinstance(item, dict) and item.get("type") == "primary":
            code = item.get("code")
            return str(code[0]) if isinstance(code, list) and code else str(code) if code else None

    first = naics_list[0]
    if isinstance(first, dict):
        code = first.get("code")
        return str(code[0]) if isinstance(code, list) and code else str(code) if code else None
    return None


def _extract_contacts_string(contacts_list: list[dict[str, Any]] | None) -> str:
    """Formats list of point of contacts into readable string."""
    if not contacts_list or not isinstance(contacts_list, list):
        return ""

    formatted = []
    for c in contacts_list:
        if not isinstance(c, dict):
            continue
        name = c.get("fullName") or c.get("title")
        email = c.get("email")
        phone = c.get("phone")
        parts = [p for p in [name, email, phone] if p]
        if parts:
            formatted.append(" | ".join(parts))
    return "; ".join(formatted)


def parse_samgov_opportunity(
    summary_item: dict[str, Any], detail_json: dict[str, Any]
) -> dict[str, Any] | None:
    """Parses SAM.gov search summary item and detail response into universal tender schema."""
    opp_id = summary_item.get("_id")
    if not opp_id:
        logger.warning("[SAM.gov] Opportunity item missing _id, skipping.")
        return None

    data2 = detail_json.get("data2", {}) if isinstance(detail_json, dict) else {}

    title = summary_item.get("title") or data2.get("title")
    if not title or not title.strip():
        logger.warning(f"[SAM.gov] Opportunity {opp_id} missing title, skipping.")
        return None

    solicitation_number = (
        summary_item.get("solicitationNumber")
        or data2.get("solicitationNumber")
        or opp_id
    )

    published_at = summary_item.get("publishDate") or detail_json.get("postedDate")
    deadline = (
        summary_item.get("responseDateActual")
        or summary_item.get("responseDate")
        or data2.get("solicitation", {}).get("deadlines", {}).get("response")
    )

    org_hierarchy = summary_item.get("organizationHierarchy") or []
    investor = _format_investor(org_hierarchy)

    locality = _extract_locality(data2.get("placeOfPerformance"))
    naics_code = _extract_primary_naics(data2.get("naics"))
    psc_code = data2.get("classificationCode")
    contacts_str = _extract_contacts_string(data2.get("pointOfContact"))

    notice_type_val = summary_item.get("type")
    notice_type = (
        notice_type_val.get("value")
        if isinstance(notice_type_val, dict)
        else str(notice_type_val)
        if notice_type_val
        else None
    )

    # Extract Statement of Work / Description body
    descriptions = detail_json.get("description") or data2.get("description") or []
    raw_body = ""
    if isinstance(descriptions, list) and descriptions:
        raw_body = descriptions[0].get("body", "")
    elif isinstance(descriptions, str):
        raw_body = descriptions

    clean_requirements = _clean_html_to_text(raw_body)
    summary_text = (
        (clean_requirements[:400] + "...")
        if len(clean_requirements) > 400
        else clean_requirements
    )

    # Award amount if available
    award_info = data2.get("award") or {}
    estimated_value = None
    if isinstance(award_info, dict) and award_info.get("amount"):
        try:
            estimated_value = float(award_info["amount"])
        except (ValueError, TypeError):
            estimated_value = None

    source_url = f"https://sam.gov/opp/{opp_id}/view"

    # Structured payload for frontend custom detail rendering
    samgov_payload = {
        "_format": SAMGOV_SCHEMA_FORMAT,
        "title": title,
        "solicitation_number": solicitation_number,
        "opportunity_id": opp_id,
        "summary": summary_text,
        "full_details": clean_requirements,
        "meta": {
            "solicitation_number": solicitation_number,
            "notice_type": notice_type,
            "department": investor,
            "location": locality,
            "sector": "IT & Telecom",
            "published": published_at,
            "closes": deadline,
            "naics": naics_code,
            "psc": psc_code,
            "contacts": contacts_str,
            "set_aside": data2.get("solicitation", {}).get("setAside"),
        },
        "source_url": source_url,
    }

    return {
        "external_code": str(solicitation_number),
        "title": title.strip(),
        "investor": investor,
        "sector": "IT & Telecom",
        "estimated_value": estimated_value,
        "currency": "USD",
        "submission_open_date": published_at,
        "submission_deadline": deadline,
        "published_at": published_at,
        "locality": locality,
        "description": json.dumps(samgov_payload, ensure_ascii=False),
        "requirements_text": clean_requirements if clean_requirements else None,
        "source_url": source_url,
    }
