"""
Client cho muasamcong.mpi.gov.vn (Cổng đấu thầu quốc gia).

Chuyển thể từ crawler-main/crawler/mua_sam_cong.py: thay vì ghi ra Excel, trả về
danh sách dict đã chuẩn hoá theo schema tender chung của hệ thống (xem
app/schemas.py::RawTenderItem).

Trang này không có API công khai/tài liệu hoá — toàn bộ logic bên dưới (endpoint,
field name, cách chọn endpoint chi tiết theo bidForm/processApply) được giữ nguyên
y hệt bản gốc đã kiểm chứng hoạt động, chỉ tổ chức lại thành các hàm module-level
thay vì closures lồng nhau, và bỏ phần ghi Excel.
"""

import concurrent.futures
import json
import logging
import math
import os
import random
import ssl
import threading
import time
import urllib.parse
from datetime import datetime, timezone

import requests
import urllib3
from playwright.sync_api import sync_playwright
from playwright_stealth import Stealth

urllib3.disable_warnings()

logger = logging.getLogger("muasamcong")

TOKEN_FILE = os.environ.get("MUASAMCONG_TOKEN_FILE", "/app/data/muasamcong_token.json")
TOKEN_RECENT_THRESHOLD_SECONDS = 600
DETAIL_FETCH_WORKERS = 10

BASE_SEARCH_URL = "https://muasamcong.mpi.gov.vn/o/egp-portal-contractor-selection-v2/services/smart/search"
BASE_DETAIL_URL = "https://muasamcong.mpi.gov.vn/o/egp-portal-contractor-selection-v2/services"
HOME_URL = "https://muasamcong.mpi.gov.vn/web/guest/home"

_token_lock = threading.Lock()


class TLSAdapter(requests.adapters.HTTPAdapter):
    """Site yêu cầu hạ SECLEVEL để tương thích cipher cũ của máy chủ chính phủ."""

    def init_poolmanager(self, *args, **kwargs):
        ctx = ssl.create_default_context()
        ctx.set_ciphers("DEFAULT:@SECLEVEL=1")
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE
        kwargs["ssl_context"] = ctx
        return super().init_poolmanager(*args, **kwargs)


BROWSER_PROFILES = [
    {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        "Sec-Ch-Ua": '"Chromium";v="122", "Not(A:Brand";v="24", "Google Chrome";v="122"',
        "Sec-Ch-Ua-Platform": '"Windows"',
    },
    {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
        "Sec-Ch-Ua": '"Not A(Brand";v="99", "Chromium";v="121", "Google Chrome";v="121"',
        "Sec-Ch-Ua-Platform": '"Windows"',
    },
    {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 Edg/122.0.0.0",
        "Sec-Ch-Ua": '"Chromium";v="122", "Not(A:Brand";v="24", "Microsoft Edge";v="122"',
        "Sec-Ch-Ua-Platform": '"Windows"',
    },
    {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        "Sec-Ch-Ua": '"Chromium";v="122", "Not(A:Brand";v="24", "Google Chrome";v="122"',
        "Sec-Ch-Ua-Platform": '"macOS"',
    },
    {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Sec-Ch-Ua": '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
        "Sec-Ch-Ua-Platform": '"Windows"',
    },
]


def get_random_browser_headers() -> dict:
    profile = random.choice(BROWSER_PROFILES)
    headers = {
        "Content-Type": "application/json",
        "Accept": "application/json, text/plain, */*",
        "Accept-Language": "vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7",
        "Sec-Ch-Ua-Mobile": "?0",
        "Sec-Fetch-Dest": "empty",
        "Sec-Fetch-Mode": "cors",
        "Sec-Fetch-Site": "same-origin",
        "Connection": "keep-alive",
    }
    headers.update(profile)
    return headers


def _session_with_cookies(cookies: list | None) -> requests.Session:
    session = requests.Session()
    proxy = os.environ.get("HTTP_PROXY") or os.environ.get("HTTPS_PROXY")
    if proxy:
        session.proxies = {"http": proxy, "https": proxy}
    session.mount("https://", TLSAdapter())
    session.headers.update(get_random_browser_headers())
    if cookies:
        for c in cookies:
            session.cookies.set(c["name"], c["value"])
    return session


def read_saved_token() -> tuple[str | None, list | None]:
    with _token_lock:
        if not os.path.exists(TOKEN_FILE):
            return None, None
        try:
            with open(TOKEN_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                return data.get("token"), data.get("cookies", [])
        except Exception:
            return None, None


def save_token(token: str, cookies: list) -> None:
    with _token_lock:
        try:
            os.makedirs(os.path.dirname(TOKEN_FILE) or ".", exist_ok=True)
            with open(TOKEN_FILE, "w", encoding="utf-8") as f:
                json.dump({"token": token, "cookies": cookies}, f)
        except Exception as exc:
            logger.warning(f"Không thể lưu token: {exc}")


def _token_file_is_recent() -> bool:
    if not os.path.exists(TOKEN_FILE):
        return False
    return time.time() - os.path.getmtime(TOKEN_FILE) < TOKEN_RECENT_THRESHOLD_SECONDS


def _push_token_to_backend_sync(token: str, cookies: list) -> None:
    """Synchronous helper — runs in a daemon thread to push the token to the NestJS backend."""
    backend_url = os.environ.get("BACKEND_INTERNAL_URL", "http://backend:3000/internal")
    api_token = os.environ.get("INTERNAL_API_TOKEN", "")
    # The BACKEND_INTERNAL_URL from env might just be "http://backend:3000",
    # so we need to make sure we append /internal if it's missing.
    if not backend_url.endswith("/internal"):
        backend_url = f"{backend_url.rstrip('/')}/internal"
        
    try:
        resp = requests.post(
            f"{backend_url}/token/muasamcong",
            json={"token": token, "cookies": cookies},
            headers={"x-internal-token": api_token, "Content-Type": "application/json"},
            timeout=10,
            verify=False,
        )
        if resp.ok:
            logger.info("[Token] MuaSamCong token pushed to backend successfully.")
        else:
            logger.warning(f"[Token] Backend returned {resp.status_code} when pushing token.")
    except Exception as exc:
        logger.warning(f"[Token] Failed to push token to backend: {exc}")


def call_search_api(keyword: str, token: str, page_num: int, cookies: list | None) -> requests.Response:
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
                        {"fieldName": "bidCloseDate", "searchType": "range", "from": now_iso, "to": None},
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


def fetch_detail_for_item(item: dict, token: str, cookies: list | None) -> dict:
    time.sleep(random.uniform(0.5, 1.0))  # Tránh rate limit

    session = _session_with_cookies(cookies)
    headers = {
        "Accept": "application/json, text/plain, */*",
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    }

    item_id = item.get("id")
    if not item_id:
        return item

    process_apply = (item.get("processApply") or "").upper()
    bid_form = (item.get("bidForm") or "").upper()

    cookie_auth_endpoints = {"online-reoffer/detail"}

    if bid_form in ("CGTTRG", "CHCTRG"):
        primary_ep = "online-reoffer/detail"
        fallbacks = ["lcnt_tbmt_ttc_ldt"]
    else:
        endpoint_map = {
            "LDT": "lcnt_tbmt_ttc_ldt",
            "KHAC": "lcnt_tbmt_ttc_vk_adb",
            "ADB": "lcnt_tbmt_ttc_vk_adb",
            "WB": "lcnt_tbmt_ttc_vk_adb",
            "DT": "lcnt_tbmt_ttc_dt",
        }
        primary_ep = endpoint_map.get(process_apply, "lcnt_tbmt_ttc_ldt")
        fallbacks = [ep for ep in ["lcnt_tbmt_ttc_ldt", "lcnt_tbmt_ttc_vk_adb", "lcnt_tbmt_ttc_dt"] if ep != primary_ep]

    endpoints = [primary_ep] + fallbacks
    got_empty = False
    for ep in endpoints:
        if ep in cookie_auth_endpoints:
            url = f"{BASE_DETAIL_URL}/{ep}"
        else:
            url = f"{BASE_DETAIL_URL}/{ep}?token={token}"
        try:
            payload = {"id": item_id}
            if process_apply and ep not in cookie_auth_endpoints:
                payload["processApply"] = process_apply
            r = session.post(url, headers=headers, json=payload, timeout=20)
            if r.status_code == 200:
                text = r.text.strip()
                if not text:
                    got_empty = True
                    continue
                data = r.json()
                if data and isinstance(data, dict):
                    cp, cpu = _find_duration_fields(data)
                    proj_name = _find_project_name(data)

                    if cp is not None:
                        unit_map = {"D": "ngày", "M": "tháng", "Y": "năm"}
                        unit_str = unit_map.get(cpu, cpu or "")
                        item["__duration__"] = f"{cp} {unit_str}".strip() if cpu else str(cp)

                    if proj_name:
                        item["__projectName__"] = proj_name
                        
                    # Fetch HSMT and Webform file metadata
                    notify_id = item.get("notifyId") or _get_str(item, "notifyId")
                    bid_field = "XL"
                    invest_fields = item.get("investField")
                    if isinstance(invest_fields, list) and len(invest_fields) > 0:
                        bid_field = invest_fields[0]
                    elif isinstance(invest_fields, str):
                        bid_field = invest_fields

                    if notify_id:
                        item["__notifyId__"] = notify_id
                        item["__bidField__"] = bid_field
                        item["__bidForm__"] = bid_form

                    if cp is not None or item.get("__duration__") or proj_name or item.get("attachments"):
                        break
            elif r.status_code in (401, 403):
                got_empty = True
                continue
        except Exception:
            pass

    if not item.get("__duration__") and got_empty:
        item["__token_expired__"] = True
    return item


def _find_duration_fields(obj) -> tuple[object | None, object | None]:
    if isinstance(obj, dict):
        c_per = obj.get("cPeriod") or obj.get("cperiod") or obj.get("contractPeriod")
        c_unit = obj.get("cPeriodUnit") or obj.get("cperiodUnit") or obj.get("contractPeriodUnit")
        b_time = obj.get("bidTime")

        if c_per is not None:
            return c_per, c_unit
        if b_time is not None:
            return str(b_time), ""

        for v in obj.values():
            cp, cpu = _find_duration_fields(v)
            if cp is not None:
                return cp, cpu
    elif isinstance(obj, list):
        for list_item in obj:
            cp, cpu = _find_duration_fields(list_item)
            if cp is not None:
                return cp, cpu
    return None, None


def _find_project_name(obj) -> str | None:
    if isinstance(obj, dict):
        name = obj.get("projectName") or obj.get("pName") or obj.get("planName")
        if name:
            return name
        for v in obj.values():
            found = _find_project_name(v)
            if found:
                return found
    elif isinstance(obj, list):
        for list_item in obj:
            found = _find_project_name(list_item)
            if found:
                return found
    return None



def acquire_token_via_browser(keyword: str) -> tuple[str | None, list | None]:
    """Mở Chromium (headed — cần Xvfb trong container), gõ từ khoá, bắt token qua network request."""
    logger.info(f"[MuaSamCong] Mở trình duyệt để lấy token cho '{keyword}'...")
    token: str | None = None

    def handle_request(request):
        nonlocal token
        if token:
            return
        if "token=" in request.url:
            query = urllib.parse.parse_qs(urllib.parse.urlparse(request.url).query)
            if "token" in query:
                token = query["token"][0]

    try:
        with sync_playwright() as p:
            proxy_url = os.environ.get("HTTP_PROXY") or os.environ.get("HTTPS_PROXY")
            launch_kwargs = {
                "headless": False,
                "args": ["--no-sandbox", "--disable-setuid-sandbox"]
            }
            if proxy_url:
                launch_kwargs["proxy"] = {"server": proxy_url}

            browser = p.chromium.launch(**launch_kwargs)
            context = browser.new_context(viewport={"width": 1280, "height": 800})
            page = context.new_page()
            Stealth().apply_stealth_sync(page)
            page.on("request", handle_request)

            try:
                page.goto(HOME_URL, timeout=60000, wait_until="domcontentloaded")
                page.wait_for_timeout(2000)
            except Exception:
                pass

            try:
                page.keyboard.press("Escape")
                page.evaluate("document.querySelectorAll('.modal, .modal-backdrop').forEach(el => el.remove())")
                page.wait_for_timeout(500)
            except Exception:
                pass

            try:
                search_input = page.locator("input[name='keyword']")
                if search_input.count() > 0:
                    search_input.first.fill(keyword)
                    search_input.first.press("Enter")
                else:
                    page.keyboard.press("Enter")
                try:
                    page.locator("button.search-btn, button:has-text('Tìm kiếm')").first.click(timeout=2000)
                except Exception:
                    pass
            except Exception:
                pass

            for _ in range(15):
                if token:
                    break
                page.wait_for_timeout(1000)

            cookies = context.cookies()
            browser.close()

            if token:
                save_token(token, cookies)
                logger.info("[MuaSamCong] Lấy token mới thành công.")
                # Push to backend asynchronously (fire-and-forget)
                import threading
                threading.Thread(
                    target=_push_token_to_backend_sync,
                    args=(token, cookies),
                    daemon=True,
                ).start()
                return token, cookies

            logger.error(
                "[MuaSamCong] KHẨN CẤP: Không thể lấy token từ muasamcong.mpi.gov.vn (trình duyệt tự động thất bại). "
                "CÁCH KHẮC PHỤC: Có thể IP hiện tại đã bị hệ thống Mua Sắm Công khóa (Rate Limit/Cloudflare). "
                "Hãy thử đổi mạng Wi-Fi, phát 4G từ điện thoại, hoặc thiết lập biến môi trường HTTP_PROXY trong file .env."
            )
            return None, None
    except Exception as exc:
        logger.error(f"[MuaSamCong] Lỗi khi mở trình duyệt lấy token: {exc}")
        return None, None


def _maybe_refresh_expired_token(keyword: str) -> tuple[str | None, list | None]:
    """Dùng khi phát hiện token hết hạn giữa chừng — bỏ qua nếu vừa mới làm mới gần đây."""
    if _token_file_is_recent():
        return None, None
    return acquire_token_via_browser(keyword)


def fetch_all_pages(keyword: str, token: str, cookies: list | None) -> list[dict]:
    all_items: list[dict] = []
    r0 = call_search_api(keyword, token, 0, cookies)
    if r0.status_code != 200:
        logger.warning(f"[MuaSamCong] Lỗi tải trang 1: {r0.status_code}")
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
                r = call_search_api(keyword, token, p, cookies)
                if r.status_code == 200:
                    d = r.json()
                    if isinstance(d, list) and len(d) > 0:
                        d = d[0]
                    return d.get("page", {}).get("content", [])
            except Exception as exc:
                if attempt == 2:
                    logger.warning(f"[MuaSamCong] Lỗi tải trang {p + 1}: {exc}")
        return []

    with concurrent.futures.ThreadPoolExecutor(max_workers=DETAIL_FETCH_WORKERS) as executor:
        futures = {executor.submit(fetch_page, p): p for p in range(1, total_pages)}
        for future in concurrent.futures.as_completed(futures):
            res = future.result()
            if res:
                all_items.extend(res)

    return all_items


def fetch_details_concurrently(items: list[dict], token: str, cookies: list | None, keyword: str) -> list[dict]:
    logger.info(f"[MuaSamCong] Đang lấy chi tiết cho {len(items)} gói thầu...")
    processed_items = []

    with concurrent.futures.ThreadPoolExecutor(max_workers=DETAIL_FETCH_WORKERS) as executor:
        futures = {executor.submit(fetch_detail_for_item, item, token, cookies): item for item in items}
        for future in concurrent.futures.as_completed(futures):
            processed_items.append(future.result())

    expired_items = [it for it in processed_items if it.get("__token_expired__")]
    if expired_items:
        logger.info(f"[MuaSamCong] {len(expired_items)} gói thầu bị lỗi token, đang lấy token mới...")
        new_token, new_cookies = _maybe_refresh_expired_token(keyword)
        if new_token:
            for it in expired_items:
                it.pop("__token_expired__", None)
                it.pop("__duration__", None)
            with concurrent.futures.ThreadPoolExecutor(max_workers=DETAIL_FETCH_WORKERS) as executor:
                futures2 = {
                    executor.submit(fetch_detail_for_item, it, new_token, new_cookies): it for it in expired_items
                }
                for future in concurrent.futures.as_completed(futures2):
                    future.result()

    return processed_items


def map_status(raw_status: str) -> str:
    if not raw_status:
        return ""
    rs = str(raw_status).upper()
    if rs == "01":
        return "Chưa đóng thầu"
    if rs in ("OPEN_BID", "OPEN_DXKT"):
        return "Đang xét thầu"
    if rs in ("03", "CANCEL", "CANCEL_BID"):
        return "Đã hủy thầu"
    if rs in ("IS_PUBLISH", "IS_PUBLIC", "PUB_KQLCNT", "OPEN_DXTC"):
        return "Có nhà thầu trúng thầu"
    return raw_status


def _get_str(data: dict, key: str) -> str:
    val = data.get(key, "")
    if isinstance(val, list):
        return ", ".join(str(v) for v in val)
    return str(val) if val is not None else ""


def _get_price(data: dict, key: str) -> float | str:
    val = data.get(key)
    if isinstance(val, list) and len(val) > 0:
        val = val[0]
    if val is None or val == "":
        return ""
    try:
        return float(val)
    except Exception:
        return str(val)


def _build_detail_link(item: dict) -> str:
    return (
        "https://muasamcong.mpi.gov.vn/web/guest/contractor-selection"
        "?p_p_id=egpportalcontractorselectionv2_WAR_egpportalcontractorselectionv2"
        "&p_p_lifecycle=0"
        "&p_p_state=normal"
        "&p_p_mode=view"
        "&_egpportalcontractorselectionv2_WAR_egpportalcontractorselectionv2_render=detail-v2"
        f"&type={_get_str(item, 'type')}"
        f"&stepCode={_get_str(item, 'stepCode')}"
        f"&id={_get_str(item, 'id')}"
        f"&notifyId={_get_str(item, 'notifyId')}"
        f"&bidOpenId={_get_str(item, 'bidOpenId')}"
        f"&processApply={_get_str(item, 'processApply')}"
        f"&bidMode={_get_str(item, 'bidMode')}"
        f"&notifyNo={_get_str(item, 'notifyNo')}"
        f"&planNo={_get_str(item, 'planNo')}"
        f"&isInternet={_get_str(item, 'isInternet')}"
        f"&bidForm={_get_str(item, 'bidForm')}"
    )


def normalize_items(items: list[dict]) -> list[dict]:
    """Lọc còn 'Chưa đóng thầu' và map sang schema tender chuẩn của hệ thống."""
    normalized = []
    for item in items:
        raw_status = str(item.get("notifyStatusName") or item.get("status") or item.get("statusForNotify", ""))
        if map_status(raw_status) != "Chưa đóng thầu":
            continue

        notify_no = _get_str(item, "notifyNo").strip()
        title = _get_str(item, "bidName").strip()
        if not notify_no or not title:
            continue

        duration = (
            item.get("__duration__")
            or item.get("bidTime")
            or item.get("contractDuration")
            or item.get("executionTime")
            or item.get("timePerform")
            or item.get("bidDuration")
        )
        if duration:
            duration_str = str(duration)
            if not any(u in duration_str for u in ("ngày", "tháng", "năm")):
                duration = f"{duration} ngày"

        project_name = (
            _get_str(item, "__projectName__")
            or _get_str(item, "investProjectName")
            or _get_str(item, "projectName")
            or _get_str(item, "pName")
            or _get_str(item, "planName")
        )

        price = _get_price(item, "bidPrice") or _get_price(item, "investPrice")

        locations = item.get("locations") or []
        locality = None
        if locations and isinstance(locations, list) and isinstance(locations[0], dict):
            locality = locations[0].get("provName") or None

        requirements_parts = []
        if duration:
            requirements_parts.append(f"Thời gian thực hiện: {duration}")
        plan_no = _get_str(item, "planNo")
        if plan_no:
            requirements_parts.append(f"Số KHLCNT: {plan_no}")

        normalized.append(
            {
                "external_code": notify_no,
                "title": title,
                "investor": _get_str(item, "investorName") or None,
                "sector": None,
                "estimated_value": price if isinstance(price, float) else None,
                "currency": "VND",
                "submission_open_date": _get_str(item, "bidOpenDate") or None,
                "submission_deadline": _get_str(item, "bidCloseDate") or None,
                "published_at": _get_str(item, "publicDate") or _get_str(item, "originalPublicDate") or None,
                "locality": locality,
                "description": project_name or None,
                "requirements_text": "; ".join(requirements_parts) or None,
                "source_url": _build_detail_link(item),
                "hsmt_data": item.get("hsmt_data"),
                "attachments": item.get("attachments"),
                "id": item.get("id"),
                "processApply": item.get("processApply"),
                "__notifyId__": item.get("__notifyId__"),
                "__id__": item.get("id"),
                "__processApply__": item.get("processApply"),
                "__bidField__": item.get("__bidField__"),
                "__bidForm__": item.get("__bidForm__"),
            }
        )

    return normalized


def search_muasamcong(keyword: str) -> list[dict]:
    """Tìm gói thầu theo từ khoá trên MuaSamCong, trả về list dict đã chuẩn hoá."""
    saved_token, saved_cookies = read_saved_token()

    if saved_token:
        try:
            r_test = call_search_api(keyword, saved_token, 0, saved_cookies)
            if r_test.status_code == 200:
                items = fetch_all_pages(keyword, saved_token, saved_cookies)
                
                import threading
                threading.Thread(
                    target=_push_token_to_backend_sync,
                    args=(saved_token, saved_cookies),
                    daemon=True,
                ).start()
                
                return _process_and_normalize(items, saved_token, saved_cookies, keyword)
        except Exception as exc:
            logger.warning(f"[MuaSamCong] Token cũ lỗi, sẽ lấy token mới: {exc}")

    token, cookies = acquire_token_via_browser(keyword)
    if not token:
        raise RuntimeError("Không thể lấy token từ muasamcong.mpi.gov.vn (trình duyệt tự động thất bại)")

    items = fetch_all_pages(keyword, token, cookies)
    return _process_and_normalize(items, token, cookies, keyword)


def _process_and_normalize(items: list[dict], token: str, cookies: list | None, keyword: str) -> list[dict]:
    if not items:
        return []

    open_items = [
        item
        for item in items
        if map_status(str(item.get("notifyStatusName") or item.get("status") or item.get("statusForNotify", "")))
        == "Chưa đóng thầu"
    ]
    logger.info(f"[MuaSamCong] '{keyword}': lọc được {len(open_items)}/{len(items)} gói thầu chưa đóng thầu")

    detailed_items = fetch_details_concurrently(open_items, token, cookies, keyword)
    return normalize_items(detailed_items)
