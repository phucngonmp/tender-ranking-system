"""
Client cho bidwinner.info.

Chuyển thể từ crawler-main/crawler/bidwinner.py: gọi thẳng API JSON tìm kiếm gói
thầu của Bidwinner (không cần trình duyệt), lấy chi tiết (Số hiệu KHLCNT,
thời gian thực hiện) qua trang HTML chi tiết, rồi trả về list dict đã chuẩn hoá
theo schema tender chung của hệ thống thay vì ghi Excel.
"""

import concurrent.futures
import logging
import random
import time
from datetime import datetime

import requests
from bs4 import BeautifulSoup

logger = logging.getLogger("bidwinner")

SEARCH_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
}
DETAIL_FETCH_WORKERS = 10


def _expand_keywords(keyword: str) -> list[str]:
    """Bidwinner không tìm tốt với từ khoá 1 chữ — tự động ghép thêm chữ phụ."""
    kw = keyword.strip()
    if len(kw.split()) == 1:
        expanded = [f"ứng dụng {kw}", f"giải pháp {kw}", f"phần mềm {kw}", f"hệ thống {kw}", f"công nghệ {kw}"]
        logger.info(f"[Bidwinner] Từ khoá 1 chữ '{kw}' được mở rộng thành: {', '.join(expanded)}")
        return expanded
    return [kw]


def _fetch_all_pages(keyword: str) -> list[dict]:
    all_items: list[dict] = []
    page = 1
    last_page = 1

    while page <= last_page:
        url = (
            "https://bidwinner.info/api/v1/bid-seeking/opening-bids"
            f"?page={page}&linh_vuc=1,3,10,5,15&keywords={keyword}&user_id=45249"
            "&dia_diem=00&du_toan=0&search_date=openning_bids&htlcnt=all&sort=thoi_diem_dang_tai"
        )
        try:
            response = requests.get(url, headers=SEARCH_HEADERS, timeout=20)
            if response.status_code != 200:
                logger.warning(f"[Bidwinner] Lỗi tải trang {page}: HTTP {response.status_code}")
                break
            data = response.json()
            if not data.get("success", False):
                logger.warning(f"[Bidwinner] Lỗi API trang {page}: {data.get('message')}")
                break
            res_data = data.get("data", {})
            items = res_data.get("data", [])
            if items:
                all_items.extend(items)
            last_page = res_data.get("last_page", 1)
            page += 1
        except Exception as exc:
            logger.warning(f"[Bidwinner] Lỗi kết nối trang {page}: {exc}")
            break

    return all_items


def _fetch_detail(item: dict) -> dict:
    time.sleep(random.uniform(0.5, 1.0))  # Tránh rate limit

    slug = item.get("slug", "")
    item["khlcnt"] = ""
    item["duration"] = ""
    if slug:
        detail_url = f"https://bidwinner.info/4.0/egp/{slug}"
        try:
            res = requests.get(detail_url, headers=SEARCH_HEADERS, timeout=15)
            if res.status_code == 200:
                soup = BeautifulSoup(res.text, "html.parser")

                th = soup.find(string=lambda t: t and "Số hiệu KHLCNT" in t)
                if th:
                    text = th.parent.parent.get_text(separator="|").strip()
                    parts = [p.strip() for p in text.split("|") if p.strip()]
                    for i, p in enumerate(parts):
                        if "Số hiệu KHLCNT" in p and i + 1 < len(parts):
                            item["khlcnt"] = parts[i + 1]
                            break

                th2 = soup.find(string=lambda t: t and "Thời gian thực hiện hợp đồng" in t)
                if th2:
                    text = th2.parent.parent.get_text(separator="|").strip()
                    parts = [p.strip() for p in text.split("|") if p.strip()]
                    for i, p in enumerate(parts):
                        if "Thời gian thực hiện hợp đồng" in p and i + 1 < len(parts):
                            item["duration"] = parts[i + 1]
                            break
        except Exception:
            pass

    raw_close_time = str(item.get("td_dong_thau", ""))
    item["iso_close_time"] = None
    if raw_close_time:
        try:
            dt_obj = datetime.strptime(raw_close_time, "%Y-%m-%d %H:%M:%S")
            item["iso_close_time"] = dt_obj.isoformat()
        except ValueError:
            pass

    raw_published_time = str(item.get("thoi_diem_dang_tai", ""))
    item["iso_published_time"] = None
    if raw_published_time:
        try:
            dt_obj = datetime.strptime(raw_published_time, "%Y-%m-%d %H:%M:%S")
            item["iso_published_time"] = dt_obj.isoformat()
        except ValueError:
            pass

    return item


def _fetch_details_concurrently(items: list[dict]) -> list[dict]:
    logger.info(f"[Bidwinner] Đang lấy chi tiết cho {len(items)} gói thầu...")
    processed = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=DETAIL_FETCH_WORKERS) as executor:
        futures = [executor.submit(_fetch_detail, item) for item in items]
        for future in concurrent.futures.as_completed(futures):
            processed.append(future.result())
    return processed


def _normalize_notify_no(raw: str) -> str:
    notify_no = str(raw or "").strip()
    if notify_no and not notify_no.startswith("IB"):
        notify_no = "IB" + notify_no
    return notify_no


def _to_float(value) -> float | None:
    if value is None or value == "":
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def normalize_items(items: list[dict]) -> list[dict]:
    normalized = []
    for item in items:
        notify_no = _normalize_notify_no(item.get("so_tbmt"))
        title = str(item.get("ten_goi_thau") or "").strip()
        if not notify_no or not title:
            continue

        requirements_parts = []
        if item.get("duration"):
            requirements_parts.append(f"Thời gian thực hiện: {item['duration']}")
        if item.get("khlcnt"):
            requirements_parts.append(f"Số hiệu KHLCNT: {item['khlcnt']}")

        slug = item.get("slug", "")
        normalized.append(
            {
                "external_code": notify_no,
                "title": title,
                "investor": item.get("owner") or None,
                "sector": None,
                "estimated_value": _to_float(item.get("dt_goi_thau_vnd")),
                "currency": "VND",
                # Bidwinner's detail page always shows a single combined
                # "Thời điểm đóng mở thầu" value, so open date mirrors close date.
                "submission_open_date": item.get("iso_close_time"),
                "submission_deadline": item.get("iso_close_time"),
                "published_at": item.get("iso_published_time"),
                "locality": item.get("dd_thuc_hien") or None,
                "description": None,
                "requirements_text": "; ".join(requirements_parts) or None,
                "source_url": f"https://bidwinner.info/4.0/egp/{slug}" if slug else "https://bidwinner.info",
            }
        )
    return normalized


def search_bidwinner(keyword: str) -> list[dict]:
    """Tìm gói thầu theo từ khoá trên Bidwinner, trả về list dict đã chuẩn hoá."""
    search_keywords = _expand_keywords(keyword)

    raw_items: list[dict] = []
    seen_notify_no: set[str] = set()
    for kw in search_keywords:
        for item in _fetch_all_pages(kw):
            notify_no = _normalize_notify_no(item.get("so_tbmt"))
            if notify_no in seen_notify_no:
                continue
            seen_notify_no.add(notify_no)
            raw_items.append(item)

    if not raw_items:
        return []

    detailed_items = _fetch_details_concurrently(raw_items)
    return normalize_items(detailed_items)
