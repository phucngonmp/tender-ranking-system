"""
Client cho crawl "kết quả đấu thầu" trên muasamcong.mpi.gov.vn: gói thầu đã
đóng thầu ở trạng thái "Đang xét thầu" (DXT) hoặc "Có nhà thầu trúng thầu"
(CNTTT), kèm danh sách nhà thầu đã bỏ thầu và kết quả lựa chọn nhà thầu (nếu
có). Tách biệt hoàn toàn khỏi app/muasamcong/client.py (crawl gói thầu MỞ cho
pipeline chấm điểm AI) — module này chỉ thu thập dữ liệu, không chấm điểm.

Cơ chế đã xác nhận bằng cách bắt request thật trên site (không phải suy đoán):
- Tìm kiếm: POST .../services/smart/search?token=<token> với filter
  bidCloseDate (to=now, tức đã đóng thầu) + statusForNotify in [DXT, CNTTT].
  Item CNTTT trả về đã có sẵn field inputResultId — không cần bước dò thêm.
- Chi tiết KQLCNT + danh sách đầy đủ nhà thầu: POST
  .../services/contractor-input-result/get, xác thực bằng cookie phiên (endpoint
  này không có query "?token=" khi bắt được trên trình duyệt thật, khác với
  smart/search). Payload chính xác (khả năng cao {"id": inputResultId}, theo
  đúng field "id" ở gốc response) chưa verify trực tiếp được do giới hạn công
  cụ điều tra — fetch_award_detail() thử vài dạng payload hợp lý theo thứ tự.
"""

import concurrent.futures
import logging
import math
import threading
import time
from datetime import datetime, timezone

import requests

from app.muasamcong.client import (
    BASE_DETAIL_URL,
    BASE_SEARCH_URL,
    DETAIL_FETCH_WORKERS,
    _build_detail_link,
    _get_price,
    _get_str,
    _push_token_to_backend_sync,
    _session_with_cookies,
    acquire_token_via_browser,
    read_saved_token,
)

logger = logging.getLogger("muasamcong.closed")

CONTRACTOR_RESULT_URL = f"{BASE_DETAIL_URL}/contractor-input-result/get"

# contractor-input-result/get is called once per item found (hundreds to low
# thousands per keyword) — DETAIL_FETCH_WORKERS (10, shared with the open-tender
# engines) opens that many fresh TLS connections at once, which the gov't server
# resets under sustained production load ("Connection aborted" /
# ConnectionResetError(104)). Kept deliberately lower here, independent of the
# other engines' concurrency.
CLOSED_DETAIL_FETCH_WORKERS = 4
# Retries specifically for transient connection failures (reset/timeout) on a
# single payload attempt, before moving on to the next payload shape.
DETAIL_CONNECTION_RETRIES = 3
DETAIL_RETRY_BACKOFF_SECONDS = 2.0

STATUS_MAP = {
    "DXT": "under_evaluation",
    "CNTTT": "awarded",
}


def call_closed_search_api(
    keyword: str, token: str, page_num: int, cookies: list | None, status: str
) -> requests.Response:
    now_iso = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.000Z")
    api_url = f"{BASE_SEARCH_URL}?token={token}"
    payload = [
        {
            "pageSize": 50,
            "pageNumber": str(page_num),
            "query": [
                {
                    "index": "es-contractor-selection",
                    "keyWord": keyword,
                    "matchType": "all-1",
                    "matchFields": ["notifyNo", "bidName"],
                    "filters": [
                        {"fieldName": "type", "searchType": "in", "fieldValues": ["es-notify-contractor"]},
                        {"fieldName": "caseKHKQ", "searchType": "not_in", "fieldValues": ["1"]},
                        {"fieldName": "bidCloseDate", "searchType": "range", "from": None, "to": now_iso},
                        # NOTE: fieldValues here does NOT behave as an OR across multiple
                        # statuses in this search engine (verified empirically — passing
                        # ["DXT", "CNTTT"] together silently drops CNTTT results). Callers
                        # must issue one search per status and merge — see fetch_all_closed_pages.
                        {"fieldName": "statusForNotify", "searchType": "in", "fieldValues": [status]},
                    ],
                }
            ],
        }
    ]
    headers = {
        "Accept": "application/json, text/plain, */*",
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    }
    session = _session_with_cookies(cookies)
    return session.post(api_url, headers=headers, json=payload, timeout=15)


def fetch_all_closed_pages(keyword: str, token: str, cookies: list | None, status: str) -> list[dict]:
    all_items: list[dict] = []
    r0 = call_closed_search_api(keyword, token, 0, cookies, status)
    if r0.status_code != 200:
        logger.warning(f"[MuaSamCong-Closed] Lỗi tải trang 1 ({status}): {r0.status_code}")
        return []

    data = r0.json()
    if isinstance(data, list) and len(data) > 0:
        data = data[0]
    items = data.get("page", {}).get("content", [])
    total_elements = data.get("page", {}).get("totalElements", 0)
    all_items.extend(items)

    if total_elements <= 50:
        return all_items

    total_pages = math.ceil(total_elements / 50)

    def fetch_page(p: int) -> list[dict]:
        for attempt in range(3):
            try:
                r = call_closed_search_api(keyword, token, p, cookies, status)
                if r.status_code == 200:
                    d = r.json()
                    if isinstance(d, list) and len(d) > 0:
                        d = d[0]
                    return d.get("page", {}).get("content", [])
            except Exception as exc:
                if attempt == 2:
                    logger.warning(f"[MuaSamCong-Closed] Lỗi tải trang {p + 1} ({status}): {exc}")
        return []

    with concurrent.futures.ThreadPoolExecutor(max_workers=DETAIL_FETCH_WORKERS) as executor:
        futures = {executor.submit(fetch_page, p): p for p in range(1, total_pages)}
        for future in concurrent.futures.as_completed(futures):
            res = future.result()
            if res:
                all_items.extend(res)

    return all_items


def fetch_award_detail(input_result_id: str, cookies: list | None) -> dict | None:
    """Gọi contractor-input-result/get -- trả về KQLCNT + danh sách đầy đủ nhà thầu bỏ thầu.
    Xác thực bằng cookie phiên (không có query "?token=" theo request bắt được thật)."""
    session = _session_with_cookies(cookies)
    headers = {
        "Accept": "application/json, text/plain, */*",
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    }

    last_exc: Exception | None = None
    for payload in ({"id": input_result_id}, [{"id": input_result_id}], {"inputResultId": input_result_id}):
        for attempt in range(DETAIL_CONNECTION_RETRIES):
            try:
                r = session.post(CONTRACTOR_RESULT_URL, headers=headers, json=payload, timeout=20)
                if r.status_code == 200 and r.text.strip():
                    data = r.json()
                    if isinstance(data, list) and len(data) > 0:
                        data = data[0]
                    if isinstance(data, dict) and data.get("bideContractorInputResultDTO"):
                        return data
                break  # clean (non-2xx or empty) response — retrying won't change that, try next payload shape
            except (requests.exceptions.ConnectionError, requests.exceptions.Timeout, requests.exceptions.SSLError) as exc:
                # Transient — server reset the connection under load (common on the
                # production host with 10-way concurrency before CLOSED_DETAIL_FETCH_WORKERS
                # was lowered). Back off and retry the same payload before giving up on it.
                last_exc = exc
                if attempt < DETAIL_CONNECTION_RETRIES - 1:
                    time.sleep(DETAIL_RETRY_BACKOFF_SECONDS * (attempt + 1))
                    continue
            except Exception as exc:
                last_exc = exc
                break

    if last_exc is not None:
        logger.warning(f"[MuaSamCong-Closed] Lỗi lấy KQLCNT cho {input_result_id}: {last_exc}")
    return None


def _normalize_bidders(award_detail: dict) -> tuple[list[dict], dict]:
    """Trả về (danh sách nhà thầu, metadata quyết định phê duyệt) từ response contractor-input-result/get."""
    dto = award_detail.get("bideContractorInputResultDTO") or {}
    bidders: list[dict] = []
    for lot in dto.get("lotResultDTO") or []:
        for c in lot.get("contractorList") or []:
            bidders.append(
                {
                    "org_code": c.get("orgCode"),
                    "org_fullname": c.get("orgFullname") or c.get("newContractorName") or "Không rõ tên nhà thầu",
                    "tax_code": c.get("taxCode"),
                    "bid_price": c.get("lotOpenPrice") or c.get("lotPrice"),
                    "final_price": c.get("lotFinalPrice"),
                    "is_winner": bool(c.get("bidResult")),
                    "winning_price": c.get("bidWiningPrice"),
                    "rank_or_reason": c.get("reason"),
                    "execution_time": c.get("bidExecutionTime"),
                    "contract_period_text": c.get("cperiodText"),
                }
            )

    meta = {
        "decision_no": dto.get("decisionNo"),
        "decision_date": dto.get("decisionDate"),
        "decision_agency": dto.get("decisionAgency"),
        "decision_file_id": dto.get("decisionFileId"),
        "decision_file_name": dto.get("decisionFileName"),
    }
    return bidders, meta


def normalize_closed_item(item: dict, award_detail: dict | None) -> dict:
    raw_status = _get_str(item, "statusForNotify")
    status = STATUS_MAP.get(raw_status, "under_evaluation")

    locations = item.get("locations") or []
    locality = None
    if locations and isinstance(locations, list) and isinstance(locations[0], dict):
        locality = locations[0].get("provName") or None

    winning_names = item.get("winningContractorName") or item.get("contractorName") or []
    if isinstance(winning_names, str):
        winning_names = [winning_names]

    estimated_value = _get_price(item, "bidPrice")
    winning_price = _get_price(item, "bidWinningPrice")

    result = {
        "notify_no": _get_str(item, "notifyNo").strip(),
        "notify_id": _get_str(item, "notifyId") or None,
        "input_result_id": _get_str(item, "inputResultId") or None,
        "title": _get_str(item, "bidName").strip(),
        "investor": _get_str(item, "investorName") or None,
        "investor_code": _get_str(item, "investorCode") or None,
        "bid_field": _get_str(item, "bidField") or None,
        "locality": locality,
        "estimated_value": estimated_value if isinstance(estimated_value, float) else None,
        "bid_close_date": _get_str(item, "bidCloseDate") or None,
        "bid_open_date": _get_str(item, "bidOpenDate") or None,
        "status": status,
        "num_bidder_join": item.get("numBidderJoin"),
        "decision_no": None,
        "decision_date": None,
        "decision_agency": None,
        "decision_file_id": None,
        "decision_file_name": None,
        "winning_contractor_names": winning_names,
        "winning_price": winning_price if isinstance(winning_price, float) else None,
        "source_url": _build_detail_link(item),
        "bidders": [],
    }

    if award_detail:
        bidders, meta = _normalize_bidders(award_detail)
        result["bidders"] = bidders
        result.update(meta)

    return result


def _fetch_and_normalize(item: dict, cookies: list | None) -> dict:
    input_result_id = item.get("inputResultId")
    award_detail = None
    if input_result_id:
        time.sleep(0.5)  # tránh rate limit
        award_detail = fetch_award_detail(input_result_id, cookies)
    return normalize_closed_item(item, award_detail)


def search_muasamcong_closed(keyword: str) -> list[dict]:
    """Tìm gói thầu đã đóng thầu (Đang xét thầu / Có nhà thầu trúng thầu) theo từ khoá,
    kèm danh sách nhà thầu bỏ thầu + kết quả lựa chọn nhà thầu nếu đã có."""
    saved_token, saved_cookies = read_saved_token()
    token, cookies = None, None

    if saved_token:
        try:
            r_test = call_closed_search_api(keyword, saved_token, 0, saved_cookies, "DXT")
            if r_test.status_code == 200:
                token, cookies = saved_token, saved_cookies
                threading.Thread(
                    target=_push_token_to_backend_sync, args=(saved_token, saved_cookies), daemon=True
                ).start()
        except Exception as exc:
            logger.warning(f"[MuaSamCong-Closed] Token cũ lỗi, sẽ lấy token mới: {exc}")

    if not token:
        token, cookies = acquire_token_via_browser(keyword)
        if not token:
            raise RuntimeError("Không thể lấy token từ muasamcong.mpi.gov.vn (trình duyệt tự động thất bại)")

    # Search per status and merge — the search engine does not OR multiple
    # statusForNotify values within a single "in" filter (see call_closed_search_api).
    items_by_notify_no: dict[str, dict] = {}
    for status in ("DXT", "CNTTT"):
        status_items = fetch_all_closed_pages(keyword, token, cookies, status)
        for it in status_items:
            notify_no = it.get("notifyNo")
            if notify_no:
                items_by_notify_no[notify_no] = it
    items = list(items_by_notify_no.values())
    if not items:
        return []

    logger.info(f"[MuaSamCong-Closed] '{keyword}': tìm được {len(items)} gói thầu đã đóng thầu (DXT/CNTTT)")

    results: list[dict] = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=CLOSED_DETAIL_FETCH_WORKERS) as executor:
        futures = {executor.submit(_fetch_and_normalize, item, cookies): item for item in items}
        for future in concurrent.futures.as_completed(futures):
            try:
                results.append(future.result())
            except Exception as exc:
                logger.warning(f"[MuaSamCong-Closed] Lỗi xử lý 1 gói thầu: {exc}")

    return [r for r in results if r["notify_no"] and r["title"]]
