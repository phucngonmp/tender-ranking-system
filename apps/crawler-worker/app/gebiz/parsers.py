import json
import re
from datetime import datetime
from urllib.parse import urljoin
from bs4 import BeautifulSoup, Tag

# ==============================================================================
# CONSTANTS & SELECTORS (Equivalent to Java `private static final`)
# ==============================================================================

GEBIZ_SCHEMA_FORMAT = "gebiz_v1"

# Supported Date Formats for GeBIZ (Singapore SGT)
SUPPORTED_DATE_FORMATS: tuple[str, ...] = (
    "%d %b %Y %I:%M %p",
    "%d %b %Y %I:%M%p",
    "%d %B %Y %I:%M %p",
    "%d %b %Y",
    "%d/%m/%Y %H:%M:%S",
)

# CSS Classes and Pattern Selectors
CSS_TITLE_LINK_CLASS = "commandLink_TITLE-BLUE"
CSS_VALUE_DIV_PATTERN = re.compile(r"formOutputText_VALUE-DIV", re.IGNORECASE)
CSS_CONTACT_TITLE_PATTERN = re.compile(r"outputText_TITLE-BLACK", re.IGNORECASE)
CSS_CONTACT_ROW_PATTERN = re.compile(r"formRow_HIDDEN-LABEL|form2_ROW|formRow_MAIN", re.IGNORECASE)
CSS_TABLE_PATTERN = re.compile(r"table_MAIN|table", re.IGNORECASE)

# Regular Expression Patterns
REGEX_DOC_CODE = re.compile(r"docCode=([A-Z0-9]+)")
REGEX_GRA_CAPACITY_BRACKET = re.compile(r"\[\$([\d,]+(?:\.\d+)?)\s*(?:\(([A-Za-z0-9\s]+)\))?\]")
REGEX_FINANCIAL_GRADE = re.compile(r"\b(EPU\s*S\d+|BCA\s*[A-C]\d+)\b", re.IGNORECASE)

# Exclusion words for contact person name (to avoid accidentally matching tender titles)
TITLE_EXCLUSION_KEYWORDS: tuple[str, ...] = (
    "TENDER",
    "PROVISION",
    "RENEW",
    "SUPPLY",
    "INVITATION",
    "REQUIREMENT",
    "SPECIFICATION",
)

# Singapore Ministry of Finance & GRA Official Financial Grading Matrix
SINGAPORE_GRA_FINANCIAL_GRADES: dict[str, dict] = {
    # EPU (Expenditure and Procurement Unit: Goods & Services / IT)
    "EPU S1": {"ceiling": 50000.0, "floor": 0.0, "range_label": "< $50K SGD"},
    "EPU S2": {"ceiling": 100000.0, "floor": 50000.0, "range_label": "$50K - $100K SGD"},
    "EPU S3": {"ceiling": 250000.0, "floor": 100000.0, "range_label": "$100K - $250K SGD"},
    "EPU S4": {"ceiling": 500000.0, "floor": 250000.0, "range_label": "$250K - $500K SGD"},
    "EPU S5": {"ceiling": 1000000.0, "floor": 500000.0, "range_label": "$500K - $1M SGD"},
    "EPU S6": {"ceiling": 3000000.0, "floor": 1000000.0, "range_label": "$1M - $3M SGD"},
    "EPU S7": {"ceiling": 5000000.0, "floor": 3000000.0, "range_label": "$3M - $5M SGD"},
    "EPU S8": {"ceiling": 10000000.0, "floor": 5000000.0, "range_label": "$5M - $10M SGD"},
    "EPU S9": {"ceiling": 30000000.0, "floor": 10000000.0, "range_label": "$10M - $30M SGD"},
    "EPU S10": {"ceiling": 50000000.0, "floor": 30000000.0, "range_label": "> $30M SGD (Unlimited)"},
    # BCA (Building and Construction Authority: Construction & Engineering)
    "BCA C3": {"ceiling": 650000.0, "floor": 0.0, "range_label": "< $650K SGD"},
    "BCA C2": {"ceiling": 1300000.0, "floor": 650000.0, "range_label": "$650K - $1.3M SGD"},
    "BCA C1": {"ceiling": 4000000.0, "floor": 1300000.0, "range_label": "$1.3M - $4M SGD"},
    "BCA B2": {"ceiling": 13000000.0, "floor": 4000000.0, "range_label": "$4M - $13M SGD"},
    "BCA B1": {"ceiling": 40000000.0, "floor": 13000000.0, "range_label": "$13M - $40M SGD"},
    "BCA A2": {"ceiling": 85000000.0, "floor": 40000000.0, "range_label": "$40M - $85M SGD"},
    "BCA A1": {"ceiling": 100000000.0, "floor": 85000000.0, "range_label": "> $85M SGD (Unlimited)"},
}

# Specification Label to Field Key Mapping
SPEC_LABEL_MAPPING: dict[str, str] = {
    "Tender No.": "tender_no",
    "Reference No.": "reference_no",
    "Agency": "agency",
    "Published": "published",
    "Offer Validity": "offer_validity",
    "Procurement Type": "procurement_type",
    "Two Envelope Bidding": "two_envelope_bidding",
    "Tender Type": "tender_type",
    "Covered under WTO": "wto_gpa",
    "Procurement Nature": "procurement_nature",
    "Procurement Method": "procurement_method",
    "Request for Proposal": "request_for_proposal",
    "GRA Supply/Work Heads": "gra_work_heads",
    "Procurement Category": "procurement_category",
}


# ==============================================================================
# PARSER UTILITIES & HELPER FUNCTIONS
# ==============================================================================


def parse_singapore_datetime(date_str: str) -> str | None:
    """Converts GeBIZ date strings into ISO 8601 string format (YYYY-MM-DDTHH:MM:SS)."""
    if not date_str or not date_str.strip():
        return None

    clean_str = re.sub(r"\s+", " ", date_str.strip())
    for fmt in SUPPORTED_DATE_FORMATS:
        try:
            dt = datetime.strptime(clean_str, fmt)
            return dt.isoformat()
        except ValueError:
            continue

    return None


def extract_gra_and_estimated_value(
    lines_or_text: list[str] | str, doc_code: str = "", proc_type: str = ""
) -> tuple[float | None, str]:
    """Extracts GRA financial tendering capacity from text or maps financial grade (EPU S1-S10, BCA C3-A1)."""
    text_content = "\n".join(lines_or_text) if isinstance(lines_or_text, list) else lines_or_text

    # 1. Match dollar value and grade code in text: [$250,000 (EPU S3)]
    dollar_match = REGEX_GRA_CAPACITY_BRACKET.search(text_content)
    grade_match = REGEX_FINANCIAL_GRADE.search(text_content)

    extracted_grade = None
    if dollar_match and dollar_match.group(2):
        extracted_grade = dollar_match.group(2).strip()
    elif grade_match:
        extracted_grade = re.sub(r"\s+", " ", grade_match.group(1).upper())

    extracted_value = None
    if dollar_match:
        try:
            extracted_value = float(dollar_match.group(1).replace(",", ""))
        except ValueError:
            pass

    # 2. If dollar amount not in text but grade code exists, lookup official Singapore ceiling
    if extracted_value is None and extracted_grade:
        normalized_grade = re.sub(r"\s+", " ", extracted_grade.upper())
        grade_info = SINGAPORE_GRA_FINANCIAL_GRADES.get(normalized_grade)
        if grade_info:
            extracted_value = grade_info["ceiling"]

    if extracted_value is not None:
        normalized_grade = re.sub(r"\s+", " ", extracted_grade.upper()) if extracted_grade else ""
        grade_info = SINGAPORE_GRA_FINANCIAL_GRADES.get(normalized_grade)
        range_suffix = f" ({grade_info['range_label']})" if grade_info else ""
        grade_display = extracted_grade or "GRA Head"
        return extracted_value, f"GRA Capacity: {grade_display}{range_suffix} [Trần: {extracted_value:,.0f} SGD]"

    # 3. Fallback to statutory thresholds based on opportunity type or doc code prefix
    code_upper = doc_code.upper()
    type_upper = proc_type.upper()
    if "ETQ" in code_upper or "QUOTATION" in type_upper:
        return 90000.0, "Estimated Ceiling: < 90,000 SGD (Quotation)"
    elif "ETL" in code_upper or "TENDER LITE" in type_upper:
        return 1000000.0, "Estimated Ceiling: 90,000 - 1,000,000 SGD (Tender Lite)"
    elif "ETT" in code_upper or "TENDER" in type_upper:
        return None, "Estimated Scope: > 1,000,000 SGD (Tender)"

    return None, ""


def _extract_text_metadata(lines: list[str]) -> tuple[str | None, str | None, str | None, str | None, str]:
    """Extracts agency, published date, closing date, category and procurement type from text lines."""
    agency = None
    published_raw = None
    closing_raw = None
    category = None
    proc_type = "Tender"

    for idx, line in enumerate(lines):
        if line == "Agency" and idx + 1 < len(lines):
            agency = lines[idx + 1]
        elif line == "Published" and idx + 1 < len(lines):
            published_raw = lines[idx + 1]
        elif line == "Closing on" and idx + 1 < len(lines):
            closing_raw = lines[idx + 1]
            if idx + 2 < len(lines) and any(marker in lines[idx + 2] for marker in ["AM", "PM", "am", "pm", ":"]):
                closing_raw += " " + lines[idx + 2]
        elif line == "Procurement Category" and idx + 1 < len(lines):
            category = lines[idx + 1]
        elif any(t in line for t in ["Quotation", "Tender Lite", "Tender"]):
            proc_type = line

    return agency, published_raw, closing_raw, category, proc_type


def parse_gebiz_card(card_element: Tag, base_url: str) -> dict | None:
    """Parses an individual GeBIZ tender card block into a dictionary matching RawTenderItem."""
    title_link = card_element.find("a", class_=CSS_TITLE_LINK_CLASS) or card_element.find(
        "a", href=lambda h: h and "docCode=" in h
    )
    if not title_link:
        return None

    title = title_link.get_text(strip=True)
    href = title_link.get("href", "")
    direct_url = urljoin(base_url, href) if href else ""

    doc_code_match = REGEX_DOC_CODE.search(href)
    doc_code = doc_code_match.group(1) if doc_code_match else ""
    if not doc_code:
        return None

    full_text = card_element.get_text(separator="\n", strip=True)
    lines = [line.strip() for line in full_text.split("\n") if line.strip()]

    agency, published_raw, closing_raw, category, proc_type = _extract_text_metadata(lines)

    published_at_iso = parse_singapore_datetime(published_raw) if published_raw else None
    closing_at_iso = parse_singapore_datetime(closing_raw) if closing_raw else None

    est_val, est_label = extract_gra_and_estimated_value(lines, doc_code, proc_type)

    desc = f"[{proc_type}] {title}"
    if est_label:
        desc += f" | {est_label}"

    return {
        "external_code": doc_code,
        "title": title,
        "investor": agency or "Singapore Government Agency",
        "sector": category or "General Procurement",
        "estimated_value": est_val,
        "currency": "SGD",
        "published_at": published_at_iso,
        "submission_open_date": published_at_iso,
        "submission_deadline": closing_at_iso,
        "locality": "Singapore",
        "description": desc,
        "requirements_text": f"Category: {category or 'N/A'}. Procurement Type: {proc_type}.",
        "source_url": direct_url,
    }


def _extract_contact_info_from_soup(soup: BeautifulSoup) -> dict:
    """Extracts contact person name, email, phone, fax, and address from HTML."""
    contact = {"name": "", "email": "", "phone": "", "fax": "", "address": ""}

    # 1. Look specifically for person name elements
    name_elements = soup.find_all(class_=CSS_CONTACT_TITLE_PATTERN)
    for name_el in name_elements:
        candidate = name_el.get_text(strip=True)
        if candidate and len(candidate) < 60 and not any(w in candidate.upper() for w in TITLE_EXCLUSION_KEYWORDS):
            contact["name"] = candidate
            break

    # 2. Extract email, phone, fax, address by icons or text patterns
    for row in soup.find_all(class_=CSS_CONTACT_ROW_PATTERN):
        text = row.get_text(strip=True)
        html_str = str(row)
        if "envelope" in html_str or ("@" in text and not contact["email"]):
            contact["email"] = text
        elif "phone" in html_str and not contact["phone"]:
            contact["phone"] = text
        elif "fax" in html_str and not contact["fax"]:
            contact["fax"] = text
        elif (
            "home" in html_str
            or "Street" in text
            or "Singapore" in text
            or "Road" in text
            or "Avenue" in text
            or "Centre" in text
        ) and not contact["address"]:
            if len(text) > 5 and not text.startswith("Singapore 1") and "@" not in text:
                contact["address"] = text
    return contact


def _extract_site_briefing_from_soup(soup: BeautifulSoup) -> dict:
    """Extracts site briefing schedule, compulsory attendance, venue, and registration remarks."""
    briefing = {
        "attendance_compulsory": "",
        "briefing_date": "",
        "briefing_time": "",
        "venue": "",
        "remarks": "",
    }
    labels = soup.find_all("label")
    for lbl in labels:
        lbl_text = lbl.get_text(strip=True)
        val_div = lbl.find_next(class_=CSS_VALUE_DIV_PATTERN)
        if not val_div:
            continue
        val_text = val_div.get_text(separator="\n", strip=True)
        if "Attendance Compulsory" in lbl_text:
            briefing["attendance_compulsory"] = val_text
        elif "Briefing Date" in lbl_text:
            briefing["briefing_date"] = val_text
        elif "Briefing Time" in lbl_text:
            briefing["briefing_time"] = val_text
        elif "Venue" in lbl_text:
            briefing["venue"] = val_text
        elif "Remarks" in lbl_text and any(k in val_text.lower() for k in ["briefing", "site", "attendance", "register"]):
            briefing["remarks"] = val_text
    return briefing


def _extract_specifications_from_soup(soup: BeautifulSoup) -> dict:
    """Extracts technical and legal tender specifications from HTML using configured mappings."""
    specs = {
        "tender_no": "",
        "reference_no": "",
        "agency": "",
        "published": "",
        "offer_validity": "",
        "procurement_type": "",
        "two_envelope_bidding": "",
        "tender_type": "",
        "wto_gpa": "",
        "procurement_nature": "",
        "procurement_method": "",
        "request_for_proposal": "",
        "gra_work_heads": "",
        "procurement_category": "",
    }
    labels = soup.find_all("label")
    for lbl in labels:
        lbl_text = lbl.get_text(strip=True)
        val_div = lbl.find_next(class_=CSS_VALUE_DIV_PATTERN)
        if not val_div:
            continue
        val_text = val_div.get_text(strip=True)

        for label_key, spec_key in SPEC_LABEL_MAPPING.items():
            if label_key in lbl_text:
                specs[spec_key] = val_text
                break

    return specs


def _extract_line_items_from_soup(soup: BeautifulSoup) -> list[dict]:
    """Extracts all items to respond with full description, UOM, quantity, remarks and embedded delivery tables."""
    repeat_container = soup.find(id=re.compile(r'j_idt590', re.I)) or soup.find(class_=re.compile(r'formRepeat_MAIN', re.I))
    if not repeat_container:
        header_node = soup.find(string=re.compile(r'ITEMS TO RESPOND', re.I))
        if header_node:
            repeat_container = header_node.find_parent(class_=re.compile(r'formSection_MAIN|formContainer_MAIN', re.I)) or soup
        else:
            repeat_container = soup

    title_elements = repeat_container.find_all(class_=CSS_CONTACT_TITLE_PATTERN)
    delivery_tables = repeat_container.find_all("table", class_=CSS_TABLE_PATTERN)

    # Filter tables that contain Location / Delivery headers
    valid_delivery_tables = []
    for tbl in delivery_tables:
        headers = [th.get_text(strip=True) for th in tbl.find_all("th")]
        if any("Location" in h or "Delivery" in h for h in headers):
            valid_delivery_tables.append(tbl)

    # Extract all label pairs for UOM, Quantity, Remarks
    uom_list: list[str] = []
    qty_list: list[str] = []
    remarks_list: list[str] = []

    labels = repeat_container.find_all("label")
    for lbl in labels:
        lt = lbl.get_text(strip=True)
        val_div = lbl.find_next(class_=CSS_VALUE_DIV_PATTERN)
        val = val_div.get_text(strip=True) if val_div else ""
        if "Unit of Measurement" in lt:
            uom_list.append(val)
        elif "Required Quantity" in lt:
            qty_list.append(val)
        elif "Remarks" in lt:
            remarks_list.append(val)

    items = []
    for idx, title_el in enumerate(title_elements):
        item_title = title_el.get_text(strip=True)
        if not item_title or len(item_title) < 5:
            continue

        uom = uom_list[idx] if idx < len(uom_list) else "LOT"
        qty = qty_list[idx] if idx < len(qty_list) else "1.0000"
        remarks = remarks_list[idx] if idx < len(remarks_list) else ""

        # Extract dedicated delivery records for this item
        delivery_records = []
        if idx < len(valid_delivery_tables):
            tbl = valid_delivery_tables[idx]
            rows = tbl.find("tbody").find_all("tr") if tbl.find("tbody") else tbl.find_all("tr")
            for row in rows:
                tds = row.find_all("td")
                if len(tds) >= 4:
                    sn = tds[0].get_text(strip=True)
                    loc = tds[1].get_text(strip=True) if len(tds) > 1 else ""
                    dt = tds[2].get_text(strip=True) if len(tds) > 2 else ""
                    q = tds[3].get_text(strip=True) if len(tds) > 3 else ""
                    terms = tds[4].get_text(strip=True) if len(tds) > 4 else ""
                    if loc or dt:
                        delivery_records.append({
                            "sn": sn,
                            "location": loc,
                            "delivery_date": dt,
                            "quantity": q,
                            "delivery_terms": terms,
                        })

        items.append({
            "item_number": f"Item No. {idx + 1}",
            "header": f"Item No. {idx + 1}",
            "mandatory_to_bid": "Yes",
            "title": item_title,
            "description": item_title,
            "uom": uom,
            "quantity": qty,
            "remarks": remarks,
            "delivery_records": delivery_records,
        })

    # Fallback to standard line item parser if repeat container didn't yield structured items
    if not items:
        full_text = soup.get_text(separator="\n", strip=True)
        lines = [line.strip() for line in full_text.split("\n") if line.strip()]
        for i, line in enumerate(lines):
            if line.startswith("Item No.") and i + 1 < len(lines):
                item_desc = lines[i + 1]
                uom = ""
                qty = ""
                for j in range(i + 1, min(i + 15, len(lines))):
                    if lines[j] == "Unit of Measurement" and j + 1 < len(lines):
                        uom = lines[j + 1]
                    elif lines[j] == "Required Quantity" and j + 1 < len(lines):
                        qty = lines[j + 1]
                items.append({
                    "item_number": line,
                    "header": line,
                    "mandatory_to_bid": "Yes",
                    "title": item_desc,
                    "description": item_desc,
                    "quantity": qty,
                    "uom": uom,
                    "remarks": "",
                    "delivery_records": [],
                })

    return items


def _extract_delivery_info_from_soup(soup: BeautifulSoup) -> list[dict]:
    """Extracts all delivery location, delivery date, quantity and delivery terms from GeBIZ delivery tables."""
    delivery_records = []
    tables = soup.find_all("table", class_=CSS_TABLE_PATTERN)
    for tbl in tables:
        headers = [th.get_text(strip=True) for th in tbl.find_all("th")]
        if not any("Location" in h or "Delivery" in h for h in headers):
            continue

        rows = tbl.find("tbody").find_all("tr") if tbl.find("tbody") else tbl.find_all("tr")
        for row in rows:
            tds = row.find_all("td")
            if len(tds) < 4:
                continue

            sn = tds[0].get_text(strip=True)
            location = tds[1].get_text(strip=True) if len(tds) > 1 else ""
            delivery_date = tds[2].get_text(strip=True) if len(tds) > 2 else ""
            quantity = tds[3].get_text(strip=True) if len(tds) > 3 else ""
            delivery_terms = tds[4].get_text(strip=True) if len(tds) > 4 else ""

            if location or delivery_date:
                delivery_records.append({
                    "sn": sn,
                    "location": location,
                    "delivery_date": delivery_date,
                    "quantity": quantity,
                    "delivery_terms": delivery_terms,
                })

    return delivery_records


def parse_gebiz_detail_page(html: str) -> dict:
    """Parses full detail HTML from opportunityDetails.xhtml into structured metadata."""
    soup = BeautifulSoup(html, "html.parser")
    full_text = soup.get_text(separator="\n", strip=True)
    lines = [line.strip() for line in full_text.split("\n") if line.strip()]

    contact = _extract_contact_info_from_soup(soup)
    site_briefing = _extract_site_briefing_from_soup(soup)
    specs = _extract_specifications_from_soup(soup)
    line_items = _extract_line_items_from_soup(soup)
    delivery_info = _extract_delivery_info_from_soup(soup)

    gra_value, gra_label = extract_gra_and_estimated_value(lines)

    return {
        "contact": contact,
        "site_briefing": site_briefing,
        "specs": specs,
        "line_items": line_items,
        "delivery_info": delivery_info,
        "gra_estimated_value": gra_value,
        "gra_label": gra_label,
    }


def build_rich_description(base_description: str, detail_data: dict) -> str:
    """Encodes GeBIZ procurement details, contact info, and site briefing into structured format."""
    contact = detail_data.get("contact", {})
    site_briefing = detail_data.get("site_briefing", {})
    specs = detail_data.get("specs", {})
    line_items = detail_data.get("line_items", [])
    delivery_info = detail_data.get("delivery_info", [])
    gra_label = detail_data.get("gra_label", "")

    # Structured JSON payload for Frontend rendering
    gebiz_payload = {
        "_format": GEBIZ_SCHEMA_FORMAT,
        "title": base_description,
        "gra_label": gra_label,
        "contact": contact,
        "site_briefing": site_briefing,
        "specs": specs,
        "line_items": line_items,
        "delivery_info": delivery_info,
    }

    return json.dumps(gebiz_payload, ensure_ascii=False)


def build_rich_requirements_text(base_requirements: str, detail_data: dict) -> str:
    """Encodes line items, delivery information and technical requirements into structured format."""
    line_items = detail_data.get("line_items", [])
    delivery_info = detail_data.get("delivery_info", [])
    specs = detail_data.get("specs", {})

    gebiz_req_payload = {
        "_format": GEBIZ_SCHEMA_FORMAT,
        "base_requirements": base_requirements,
        "line_items": line_items,
        "delivery_info": delivery_info,
        "specs": specs,
    }

    return json.dumps(gebiz_req_payload, ensure_ascii=False)
