"""
Per-domain CSS extraction schemas for crawl4ai's JsonCssExtractionStrategy.

Add an entry here when a tender portal has a stable, repeated HTML structure —
CSS extraction is faster and cheaper than the LLM fallback. Any domain not
listed here falls back to LLM-based extraction (see app/crawler.py).

Schema shape follows crawl4ai's JsonCssExtractionStrategy convention:
{
    "baseSelector": "css selector matching each tender listing item",
    "fields": [
        {"name": "title", "selector": "...", "type": "text"},
        {"name": "external_code", "selector": "...", "type": "text"},
        {"name": "investor", "selector": "...", "type": "text"},
        {"name": "sector", "selector": "...", "type": "text"},
        {"name": "estimated_value", "selector": "...", "type": "text"},
        {"name": "currency", "selector": "...", "type": "text"},
        {"name": "submission_deadline", "selector": "...", "type": "text"},
        {"name": "description", "selector": "...", "type": "text"},
        {"name": "requirements_text", "selector": "...", "type": "text"},
    ],
}

Example (fill in real selectors after inspecting a specific portal):

DOMAIN_SCHEMAS = {
    "muasamcong.mpi.gov.vn": {
        "baseSelector": "table.tender-list tr",
        "fields": [
            {"name": "title", "selector": "td.title a", "type": "text"},
            {"name": "external_code", "selector": "td.code", "type": "text"},
        ],
    },
}
"""

DOMAIN_SCHEMAS: dict[str, dict] = {}
