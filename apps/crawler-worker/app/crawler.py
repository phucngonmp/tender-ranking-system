import json
import logging
import os
from urllib.parse import urlparse

from crawl4ai import (
    AsyncWebCrawler,
    CrawlerRunConfig,
    JsonCssExtractionStrategy,
    LLMConfig,
    LLMExtractionStrategy,
)
from crawl4ai.cache_context import CacheMode

from app.extractors.domain_schemas import DOMAIN_SCHEMAS

logger = logging.getLogger("crawler")

TENDER_FIELD_DESCRIPTIONS = {
    "title": "string, tên/tiêu đề gói thầu",
    "external_code": "string or null, mã số gói thầu/thông báo mời thầu",
    "investor": "string or null, tên chủ đầu tư/bên mời thầu",
    "sector": "string or null, lĩnh vực/ngành nghề",
    "estimated_value": "number or null, giá trị gói thầu (chỉ số, không có ký tự tiền tệ)",
    "currency": "string or null, đơn vị tiền tệ, ví dụ VND hoặc USD",
    "submission_deadline": "string or null, hạn nộp hồ sơ dạng ISO 8601 (YYYY-MM-DD)",
    "description": "string or null, mô tả tóm tắt gói thầu",
    "requirements_text": "string or null, yêu cầu kỹ thuật/năng lực nhà thầu",
}

EXTRACTION_INSTRUCTION = (
    "Trích xuất danh sách các gói thầu hiển thị trên trang này. Trả về một mảng JSON, "
    "mỗi phần tử là một gói thầu theo đúng các trường đã mô tả. Nếu trang chỉ hiển thị "
    "một gói thầu duy nhất, vẫn trả về mảng có 1 phần tử. Bỏ qua các mục không phải gói thầu."
)


class CrawlError(Exception):
    pass


def _build_extraction_strategy(url: str):
    domain = urlparse(url).netloc
    css_schema = DOMAIN_SCHEMAS.get(domain)
    if css_schema:
        logger.info(f"Using CSS extraction schema for domain {domain}")
        return JsonCssExtractionStrategy(css_schema)

    logger.info(f"No CSS schema for domain {domain}, falling back to LLM extraction")
    
    # Choose AI provider (priority: Gemini -> OpenAI -> OpenRouter)
    gemini_key = os.environ.get("GEMINI_API_KEY")
    gemini_model = os.environ.get("GEMINI_MODEL", "gemini-3.5-flash-lite")
    openai_key = os.environ.get("OPENAI_API_KEY")
    openai_model = os.environ.get("OPENAI_MODEL", "gpt-4o-mini")
    openai_base_url = os.environ.get("OPENAI_BASE_URL")
    openrouter_key = os.environ.get("OPENROUTER_API_KEY")
    openrouter_model = os.environ.get("OPENROUTER_MODEL", "openrouter/auto")
    openrouter_base_url = os.environ.get("OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1")

    if gemini_key:
        provider = f"gemini/{gemini_model}"
        api_token = gemini_key
        base_url = None
    elif openai_key:
        provider = f"openai/{openai_model}"
        api_token = openai_key
        base_url = openai_base_url
    elif openrouter_key:
        provider = f"openai/{openrouter_model}"
        api_token = openrouter_key
        base_url = openrouter_base_url
    else:
        provider = f"openai/{openai_model}"
        api_token = None
        base_url = None

    return LLMExtractionStrategy(
        llm_config=LLMConfig(
            provider=provider,
            api_token=api_token,
            base_url=base_url,
        ),
        instruction=EXTRACTION_INSTRUCTION,
        schema=TENDER_FIELD_DESCRIPTIONS,
        extraction_type="schema",
        apply_chunking=False,
        force_json_response=True,
    )


def _normalize_items(raw_items: list, source_url: str) -> list[dict]:
    normalized = []
    for item in raw_items:
        if not isinstance(item, dict):
            continue
        title = (item.get("title") or "").strip()
        if not title:
            continue
        normalized.append(
            {
                "external_code": item.get("external_code"),
                "title": title,
                "investor": item.get("investor"),
                "sector": item.get("sector"),
                "estimated_value": item.get("estimated_value"),
                "currency": item.get("currency"),
                "submission_deadline": item.get("submission_deadline"),
                "description": item.get("description"),
                "requirements_text": item.get("requirements_text"),
                "source_url": source_url,
            }
        )
    return normalized


async def crawl_and_extract(url: str) -> list[dict]:
    """
    Crawl a tender listing page and return normalized tender dicts.
    Raises CrawlError on robots.txt block or crawl/extraction failure.
    """
    extraction_strategy = _build_extraction_strategy(url)

    run_config = CrawlerRunConfig(
        extraction_strategy=extraction_strategy,
        check_robots_txt=True,
        cache_mode=CacheMode.BYPASS,
        page_timeout=60_000,
        max_retries=2,
    )

    async with AsyncWebCrawler() as crawler:
        result = await crawler.arun(url=url, config=run_config)

        if not result.success:
            raise CrawlError(result.error_message or f"Crawl failed for {url}")

        if not result.extracted_content:
            return []

        try:
            parsed = json.loads(result.extracted_content)
        except json.JSONDecodeError as exc:
            raise CrawlError(f"Failed to parse extracted content as JSON: {exc}") from exc

        if isinstance(parsed, dict):
            parsed = [parsed]

        return _normalize_items(parsed, url)
