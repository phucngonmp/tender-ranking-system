import asyncio
import logging
import os
from typing import Callable

import httpx
from fastapi import BackgroundTasks, FastAPI, Header, HTTPException
from pydantic import BaseModel

from app.bidwinner.client import search_bidwinner
from app.callback import send_callback
from app.crawler import CrawlError, crawl_and_extract
from app.dauthauasia.client import search_dauthauasia
from app.gebiz.client import search_gebiz
from app.freetender.client import search_freetender
from app.samgov.client import search_samgov
from app.muasamcong.client import search_muasamcong, read_saved_token
from app.muasamcong.closed_client import search_muasamcong_closed
from app.schemas import CrawlRequest, KeywordSearchRequest, ClosedTenderSearchRequest

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("crawler-worker")

app = FastAPI(title="Tender Crawler Worker")

INTERNAL_API_TOKEN = os.environ.get("INTERNAL_API_TOKEN")
BACKEND_INTERNAL_URL = os.environ.get("BACKEND_INTERNAL_URL", "http://backend:3000/internal")


class MuasamcongTokenPush(BaseModel):
    token: str
    cookies: list[dict] = []


def _check_internal_token(x_internal_token: str | None) -> None:
    if INTERNAL_API_TOKEN and x_internal_token != INTERNAL_API_TOKEN:
        raise HTTPException(status_code=401, detail="Invalid internal token")


async def _push_token_to_backend(token: str, cookies: list) -> None:
    """Fire-and-forget: push the freshly acquired MSC token to the NestJS backend."""
    
    backend_url = BACKEND_INTERNAL_URL
    if not backend_url.endswith("/internal"):
        backend_url = f"{backend_url.rstrip('/')}/internal"

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            await client.post(
                f"{backend_url}/token/muasamcong",
                json={"token": token, "cookies": cookies},
                headers={"x-internal-token": INTERNAL_API_TOKEN or ""},
            )
        logger.info("[Token] Pushed MuaSamCong token to backend.")
    except Exception as exc:
        logger.warning(f"[Token] Failed to push token to backend: {exc}")


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.post("/crawl", status_code=202)
async def crawl(
    req: CrawlRequest,
    background_tasks: BackgroundTasks,
    x_internal_token: str | None = Header(default=None),
):
    _check_internal_token(x_internal_token)
    background_tasks.add_task(_run_crawl_job, req)
    return {"accepted": True}


async def _run_crawl_job(req: CrawlRequest) -> None:
    try:
        items = await crawl_and_extract(req.url)
        await send_callback(
            req.callback_url,
            {
                "crawl_job_id": req.crawl_job_id,
                "source_id": req.source_id,
                "status": "success",
                "items": items,
            },
            INTERNAL_API_TOKEN,
        )
    except CrawlError as exc:
        logger.warning(f"Crawl failed for {req.url}: {exc}")
        await send_callback(
            req.callback_url,
            {
                "crawl_job_id": req.crawl_job_id,
                "source_id": req.source_id,
                "status": "failed",
                "error_message": str(exc),
            },
            INTERNAL_API_TOKEN,
        )
    except Exception as exc:  # noqa: BLE001 - report all crawl failures back via callback
        logger.exception(f"Unexpected error crawling {req.url}")
        await send_callback(
            req.callback_url,
            {
                "crawl_job_id": req.crawl_job_id,
                "source_id": req.source_id,
                "status": "failed",
                "error_message": f"Unexpected error: {exc}",
            },
            INTERNAL_API_TOKEN,
        )


def _split_keywords(raw: str) -> list[str]:
    """Source.keyword may hold several comma-separated keywords to search in turn."""
    return [k.strip() for k in raw.split(",") if k.strip()]


def _register_keyword_search_endpoint(path: str, label: str, search_fn: Callable[[str], list[dict]]) -> None:
    """Wires up a POST {path} endpoint shared by all keyword-based engines
    (MuaSamCong, Bidwinner, DauThau.Asia): accept the job, run the (blocking)
    search function in a thread once per comma-separated keyword, merge the
    results (de-duplicated by external_code, since the same tender can match
    more than one keyword), and report success/failure via callback.
    """

    async def run_job(req: KeywordSearchRequest) -> None:
        keywords = _split_keywords(req.keyword) or [req.keyword]
        all_items: list[dict] = []
        seen_codes: set[str] = set()
        errors: list[str] = []

        for idx, kw in enumerate(keywords, start=1):
            logger.info(f"[{label}] ({idx}/{len(keywords)}) Đang tìm theo từ khoá '{kw}'...")
            try:
                kw_items = await asyncio.to_thread(search_fn, kw)
            except Exception as exc:  # noqa: BLE001 - keep going with the remaining keywords
                logger.exception(f"{label} search failed for keyword '{kw}'")
                errors.append(f"'{kw}': {exc}")
                continue

            for item in kw_items:
                code = item.get("external_code")
                if code:
                    if code in seen_codes:
                        continue
                    seen_codes.add(code)
                item["matched_keyword"] = kw
                all_items.append(item)

        try:
            if not all_items and errors:
                await send_callback(
                    req.callback_url,
                    {
                        "crawl_job_id": req.crawl_job_id,
                        "source_id": req.source_id,
                        "status": "failed",
                        "error_message": "; ".join(errors),
                    },
                    INTERNAL_API_TOKEN,
                )
                return

            await send_callback(
                req.callback_url,
                {
                    "crawl_job_id": req.crawl_job_id,
                    "source_id": req.source_id,
                    "status": "success",
                    "items": all_items,
                },
                INTERNAL_API_TOKEN,
            )
        except Exception as exc:  # noqa: BLE001 - report all failures back via callback
            logger.exception(f"{label} search failed for keywords {keywords}")
            await send_callback(
                req.callback_url,
                {
                    "crawl_job_id": req.crawl_job_id,
                    "source_id": req.source_id,
                    "status": "failed",
                    "error_message": f"Unexpected error: {exc}",
                },
                INTERNAL_API_TOKEN,
            )

    @app.post(path, status_code=202, name=f"{label}_search")
    async def endpoint(
        req: KeywordSearchRequest,
        background_tasks: BackgroundTasks,
        x_internal_token: str | None = Header(default=None),
    ):
        _check_internal_token(x_internal_token)
        background_tasks.add_task(run_job, req)
        return {"accepted": True}


_register_keyword_search_endpoint("/muasamcong/search", "MuaSamCong", search_muasamcong)
_register_keyword_search_endpoint("/bidwinner/search", "Bidwinner", search_bidwinner)
_register_keyword_search_endpoint("/dauthauasia/search", "DauThauAsia", search_dauthauasia)
_register_keyword_search_endpoint("/gebiz/search", "GeBIZ", search_gebiz)
_register_keyword_search_endpoint("/freetender/search", "FreeTender", search_freetender)
_register_keyword_search_endpoint("/samgov/search", "SAM.gov", search_samgov)


@app.post("/muasamcong/closed-search", status_code=202)
async def closed_search(
    req: ClosedTenderSearchRequest,
    background_tasks: BackgroundTasks,
    x_internal_token: str | None = Header(default=None),
):
    """Crawl gói thầu MuaSamCong đã đóng thầu (Đang xét thầu / Có nhà thầu trúng
    thầu) — chức năng lấy dữ liệu riêng, không chấm điểm, không đi qua /crawl."""
    _check_internal_token(x_internal_token)
    background_tasks.add_task(_run_closed_tender_job, req)
    return {"accepted": True}


async def _run_closed_tender_job(req: ClosedTenderSearchRequest) -> None:
    keywords = _split_keywords(req.keyword) or [req.keyword]
    all_results: list[dict] = []
    seen_codes: set[str] = set()
    errors: list[str] = []

    for idx, kw in enumerate(keywords, start=1):
        logger.info(f"[MuaSamCong-Closed] ({idx}/{len(keywords)}) Đang tìm theo từ khoá '{kw}'...")
        try:
            kw_results = await asyncio.to_thread(search_muasamcong_closed, kw)
        except Exception as exc:  # noqa: BLE001 - keep going with the remaining keywords
            logger.exception(f"MuaSamCong-Closed search failed for keyword '{kw}'")
            errors.append(f"'{kw}': {exc}")
            continue

        for result in kw_results:
            code = result.get("notify_no")
            if code:
                if code in seen_codes:
                    continue
                seen_codes.add(code)
            result["matched_keyword"] = kw
            all_results.append(result)

    try:
        if not all_results and errors:
            await send_callback(
                req.callback_url,
                {
                    "crawl_job_id": req.crawl_job_id,
                    "keyword_id": req.keyword_id,
                    "status": "failed",
                    "error_message": "; ".join(errors),
                },
                INTERNAL_API_TOKEN,
            )
            return

        await send_callback(
            req.callback_url,
            {
                "crawl_job_id": req.crawl_job_id,
                "keyword_id": req.keyword_id,
                "status": "success",
                "results": all_results,
            },
            INTERNAL_API_TOKEN,
        )
    except Exception as exc:  # noqa: BLE001 - report all failures back via callback
        logger.exception(f"MuaSamCong-Closed search failed for keywords {keywords}")
        await send_callback(
            req.callback_url,
            {
                "crawl_job_id": req.crawl_job_id,
                "keyword_id": req.keyword_id,
                "status": "failed",
                "error_message": f"Unexpected error: {exc}",
            },
            INTERNAL_API_TOKEN,
        )


@app.post("/muasamcong/token", status_code=200)
async def push_muasamcong_token(
    payload: MuasamcongTokenPush,
    x_internal_token: str | None = Header(default=None),
):
    """
    Receives the latest MuaSamCong session token from the crawler process
    (e.g. after Playwright acquires a fresh one) and forwards it to the
    NestJS backend so the BE can use it for the backup HSMT download flow.
    """
    _check_internal_token(x_internal_token)
    await _push_token_to_backend(payload.token, payload.cookies)
    return {"ok": True}


@app.post("/muasamcong/refresh-token", status_code=200)
async def refresh_muasamcong_token(
    x_internal_token: str | None = Header(default=None),
):
    """
    On-demand endpoint triggered by the Backend when it detects the token has expired.
    Synchronously opens browser to get a new token, pushes it to Backend, and returns it.
    """
    _check_internal_token(x_internal_token)
    from app.muasamcong.client import acquire_token_via_browser
    import asyncio
    
    logger.info("[Token] Backend requested a manual token refresh.")
    
    # We use a dummy keyword to trigger the search in Playwright
    token, cookies = await asyncio.to_thread(acquire_token_via_browser, "chuyển đổi số")
    if token:
        # Pushing to backend synchronously is optional since we return it in response,
        # but _push_token_to_backend_sync is already triggered inside acquire_token_via_browser.
        return {"token": token, "cookies": cookies}
    
    raise HTTPException(status_code=500, detail="Failed to acquire new token via browser")

@app.on_event("startup")
async def _push_saved_token_on_startup():
    """On startup, if the crawler already has a saved token, push it to the BE immediately."""
    token, cookies = read_saved_token()
    if token:
        logger.info("[Startup] Found saved MSC token, pushing to backend...")
        await _push_token_to_backend(token, cookies or [])
