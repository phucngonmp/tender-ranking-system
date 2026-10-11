import json
import logging
import re
from datetime import datetime, timezone
from urllib.parse import urlparse

from bs4 import BeautifulSoup

logger = logging.getLogger("freetender")

FREETENDER_SCHEMA_FORMAT = "freetender_v1"

DATE_FORMATS = (
    "%d %b %Y, %H:%M UTC",
    "%d %B %Y, %H:%M UTC",
    "%d %b %Y",
    "%d %B %Y",
    "%Y-%m-%d",
    "%Y-%m-%dT%H:%M:%S",
)

SEPTEMBER_REGEX = re.compile(r"(?i)\bsept\b")

SUBHEADINGS_REGEX = [
    r"Objective\.",
    r"Minimum Performance Requirements\.",
    r"Implementation\.",
    r"Summary of notice\b",
    r"Summay of notice\b",
    r"Qualifications for participating\b",
]


def _parse_freetender_date(raw: str | None) -> str | None:
    """Parses FreeTender date string into ISO 8601 string format."""
    if not raw or not raw.strip():
        return None

    normalized = SEPTEMBER_REGEX.sub("Sep", raw.strip())
    for fmt in DATE_FORMATS:
        try:
            dt = datetime.strptime(normalized, fmt)
            if "UTC" in fmt:
                dt = dt.replace(tzinfo=timezone.utc)
            return dt.isoformat()
        except ValueError:
            pass
    return None


def _extract_dt_map(soup: BeautifulSoup) -> dict[str, str]:
    """Extracts key-value pairs from definition list (<dt>/<dd>) elements."""
    dt_map = {}
    for dt in soup.find_all("dt"):
        key = dt.get_text(strip=True)
        dd = dt.find_next_sibling("dd")
        if dd:
            dt_map[key] = dd.get_text(strip=True)
    return dt_map


def _extract_official_portal_url(soup: BeautifulSoup) -> str | None:
    """Extracts the original verified government portal URL."""
    for a in soup.find_all("a", href=True):
        href = a["href"]
        text = a.get_text(strip=True).lower()
        if (
            href.startswith("http")
            and "freetender.net" not in href
            and any(kw in text for kw in ["official", "apply", "portal", "verify"])
        ):
            return href
    return None


def _extract_issuer_and_portal(soup: BeautifulSoup) -> tuple[str | None, str | None]:
    """Extracts the procuring organization (issuer) and publishing portal (e.g. SAM.gov, JETRO)."""
    for el in soup.find_all(["p", "div", "span"]):
        text = el.get_text(separator=" ", strip=True)
        if "Issued by" in text:
            match = re.search(r"Issued by\s+(.+?)(?:\s*[·•]?\s*via\s+(.+))?$", text, re.I)
            if match:
                issuer = match.group(1).strip().rstrip("·•").strip()
                portal = match.group(2).strip() if match.group(2) else None
                # Clean up action text attached to the end
                if portal and "verify" in portal.lower():
                    portal = re.split(r"verify\s*&", portal, flags=re.I)[0].strip()
                if issuer and "verify" in issuer.lower():
                    issuer = re.split(r"verify\s*&", issuer, flags=re.I)[0].strip()
                return issuer, portal
    return None, None


def _format_procurement_text(text: str | None) -> str:
    """Formats monolithic procurement text into clean paragraphs with readable line breaks."""
    if not text or not text.strip():
        return ""

    s = text.strip()

    # 1. Break before parenthesized roman numerals or numbers followed by a capital letter: (i) Description, (ii) Solicitation...
    s = re.sub(
        r"\s*(\((?:x{1,2}[ivx]*|v?i{1,4}|iv|v|ix|[a-z]|\d{1,2})\))\s*(?=[A-Z])",
        r"\n\n\1 ",
        s,
    )

    # 2. Break before circled numbers: ⑴, ⑵, ⑶, ..., ⑽, ①, ②, etc.
    s = re.sub(
        r"\s*([⑴-⒇①-⑳])\s*",
        r"\n\n\1 ",
        s,
    )

    # 3. Break before bullet points: •, ⁃, ◦, ▪
    s = re.sub(
        r"\s*([•⁃◦▪])\s*",
        r"\n• ",
        s,
    )

    # 4. Break before exact uppercase headers
    s = re.sub(
        r"\s*\b(COMBINED SYNOPSIS/SOLICITATION)\b\s*",
        r"\n\n\1\n",
        s,
    )

    # 5. Break before common solicitation subheadings after a sentence end
    for sh in SUBHEADINGS_REGEX:
        s = re.sub(
            rf"(?<=[.!?])\s+({sh})\s*",
            r"\n\n\1\n",
            s,
        )

    # Clean up excessive newlines
    s = re.sub(r"\n{3,}", "\n\n", s)
    return s.strip()


def _extract_details_section(soup: BeautifulSoup) -> tuple[str, str]:
    """Extracts clean summary and detailed statement of work without sidebar/recommendation noise."""
    h_details = soup.find(
        lambda el: el.name in ["h2", "h3", "h4"] and el.get_text(strip=True).lower() == "details"
    )
    section = h_details.find_parent("section") if h_details else None
    if not section:
        # Fallback to article
        article = soup.find("article", class_="min-w-0")
        section = article.find("section") if article else soup.find("section")

    if not section:
        return "", ""

    ps = [
        p.get_text(separator=" ", strip=True)
        for p in section.find_all("p")
        if p.get_text(strip=True)
    ]
    # Filter out action buttons or read more labels
    ps = [p for p in ps if not re.match(r"^read full details", p, re.I)]

    if not ps:
        return section.get_text(separator="\n", strip=True), ""

    raw_summary = ps[0]
    raw_full_details = "\n\n".join(ps[1:]) if len(ps) > 1 else ""

    summary = _format_procurement_text(raw_summary)
    full_details = _format_procurement_text(raw_full_details)
    return summary, full_details


def _extract_classification_codes(text: str) -> dict[str, str | None]:
    """Detects NAICS, PSC, or solicitation numbers embedded in the tender text."""
    codes: dict[str, str | None] = {"naics": None, "psc": None, "solicitation_number": None}

    naics_match = re.search(r"\bNAICS\s*([0-9]{4,6})\b", text, re.I)
    if naics_match:
        codes["naics"] = naics_match.group(1)

    psc_match = re.search(r"\b(?:Product/service code|PSC)\s*([A-Z0-9]{2,6})\b", text, re.I)
    if psc_match:
        codes["psc"] = psc_match.group(1)

    sol_match = re.search(r"\bSolicitation number\s*([A-Z0-9-]+)\b", text, re.I)
    if sol_match:
        codes["solicitation_number"] = sol_match.group(1)

    return codes


def _build_external_code(dt_map: dict, url: str) -> str:
    """Resolves external code from metadata reference or URL path."""
    code = dt_map.get("Reference") or dt_map.get("Ref") or dt_map.get("Ref No")
    if code:
        return code
    path = urlparse(url).path
    return path.rstrip("/").split("/")[-1] or "unknown"


def parse_freetender_detail(html_content: str, url: str) -> dict | None:
    """Parses FreeTender detail HTML into a standardized, rich tender payload."""
    soup = BeautifulSoup(html_content, "html.parser")
    dt_map = _extract_dt_map(soup)

    h1 = soup.find("h1")
    title = h1.get_text(strip=True) if h1 else None
    if not title:
        logger.warning(f"[FreeTender] Không tìm thấy tiêu đề gói thầu tại: {url}")
        return None

    external_code = _build_external_code(dt_map, url)
    published_at = _parse_freetender_date(dt_map.get("Published"))
    deadline = _parse_freetender_date(dt_map.get("Closes") or dt_map.get("Deadline"))
    locality = dt_map.get("Location") or dt_map.get("Country") or "Unknown"
    sector = dt_map.get("Sector") or "IT & Telecom"
    notice_type = dt_map.get("Type") or None

    official_url = _extract_official_portal_url(soup)
    issuer, portal = _extract_issuer_and_portal(soup)
    summary, full_details = _extract_details_section(soup)

    classification_codes = _extract_classification_codes(f"{summary} {full_details}")

    # Fallback issuer
    investor = issuer or dt_map.get("Buyer") or dt_map.get("Authority") or None

    # Structured payload for Frontend rendering
    freetender_payload = {
        "_format": FREETENDER_SCHEMA_FORMAT,
        "title": title,
        "summary": summary,
        "full_details": full_details,
        "meta": {
            "reference": external_code,
            "location": locality,
            "sector": sector,
            "type": notice_type,
            "published": dt_map.get("Published"),
            "closes": dt_map.get("Closes") or dt_map.get("Deadline"),
            "issuer": investor,
            "source_portal": portal,
            "naics": classification_codes.get("naics"),
            "psc": classification_codes.get("psc"),
            "solicitation_number": classification_codes.get("solicitation_number"),
        },
        "official_url": official_url,
        "freetender_url": url,
    }

    # source_url prioritizes verified authority link, fallback to freetender listing
    source_url = official_url or url

    # requirements_text stores the clean technical specifications / Statement of Work
    # rather than polluting it with listing links.
    requirements_text = full_details if full_details else None

    return {
        "external_code": external_code,
        "title": title,
        "investor": investor,
        "sector": sector,
        "estimated_value": None,
        "currency": "USD",
        "submission_open_date": published_at,
        "submission_deadline": deadline,
        "published_at": published_at,
        "locality": locality,
        "description": json.dumps(freetender_payload, ensure_ascii=False),
        "requirements_text": requirements_text,
        "source_url": source_url,
    }
