"""
Client cho dauthau.asia.

Chuyển thể từ crawler-main/crawler/dau_thau_asia.py: crawl HTML (requests +
BeautifulSoup) trang tìm kiếm gói thầu theo từ khoá, phân trang tới khi hết gói
thầu còn hạn nộp, lấy chi tiết (tên dự án, số KHLCNT) từng gói thầu, rồi trả về
list dict đã chuẩn hoá theo schema tender chung thay vì ghi Excel.
"""

import concurrent.futures
import logging
import random
import re
import time
from datetime import datetime
from urllib.parse import quote_plus

import requests
from bs4 import BeautifulSoup

logger = logging.getLogger("dauthauasia")

REQUEST_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Accept-Language": "vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7",
}
DETAIL_FETCH_WORKERS = 10
# Không còn danh sách "đã thấy" bền vững (Excel) để tự dừng phân trang khi trùng
# lặp như bản gốc, nên giới hạn cứng số trang để tránh vòng lặp quá dài với từ
# khoá quá rộng.
MAX_PAGES = 30


def _fetch_search_page(keyword: str, page_num: int) -> list[dict]:
    encoded_keyword = quote_plus(keyword)
    base_url = f"https://dauthau.asia/thongbao/moithau/?q={encoded_keyword}"
    url = base_url if page_num == 1 else f"{base_url}&page={page_num}"

    response = requests.get(url, headers=REQUEST_HEADERS, timeout=15)
    if response.status_code != 200:
        raise RuntimeError(f"HTTP {response.status_code}")

    soup = BeautifulSoup(response.text, "html.parser")
    rows = soup.select("tr:has(td[data-column='Gói thầu'])")

    now = datetime.now()
    items = []
    for row in rows:
        goi_thau_el = row.select_one("td[data-column='Gói thầu'] a")
        chu_dau_tu_el = row.select_one("td[data-column='Chủ đầu tư'] a")
        dong_thau_el = row.select_one("td[data-column='Đóng thầu'] div")

        if not goi_thau_el:
            continue

        code_span = goi_thau_el.select_one(".bidding-code")
        ma_tbmt = code_span.text.strip() if code_span else ""

        goi_thau = goi_thau_el.get("title") or goi_thau_el.text.strip()
        if ma_tbmt and goi_thau.startswith(ma_tbmt):
            goi_thau = goi_thau.replace(ma_tbmt, "").strip()

        href = goi_thau_el.get("href", "")
        detail_url = f"https://dauthau.asia{href}" if href.startswith("/") else href

        chu_dau_tu = ""
        if chu_dau_tu_el:
            chu_dau_tu = chu_dau_tu_el.get("title") or chu_dau_tu_el.text.strip()
        chu_dau_tu = re.sub(r"^(vn|VN)?\d{5,}(-[0-9]+)?\s+", "", chu_dau_tu)

        dong_thau_str = dong_thau_el.text.strip() if dong_thau_el else ""
        if not dong_thau_str:
            continue
        try:
            dong_thau_date = datetime.strptime(dong_thau_str, "%H:%M %d/%m/%Y")
        except Exception:
            continue

        if dong_thau_date <= now:
            continue  # Đã hết hạn đóng thầu

        items.append(
            {
                "ma_tbmt": ma_tbmt,
                "goi_thau": goi_thau,
                "chu_dau_tu": chu_dau_tu,
                "dong_thau_iso": dong_thau_date.isoformat(),
                "detail_url": detail_url,
            }
        )

    return items


def _fetch_all_pages(keyword: str) -> list[dict]:
    all_items: list[dict] = []
    seen_ma_tbmt: set[str] = set()

    for page_num in range(1, MAX_PAGES + 1):
        try:
            page_items = _fetch_search_page(keyword, page_num)
        except Exception as exc:
            logger.warning(f"[DauThau.Asia] Lỗi tải trang {page_num}: {exc}")
            break

        if not page_items:
            logger.info(f"[DauThau.Asia] Trang {page_num}: hết gói thầu còn hạn nộp. Dừng.")
            break

        new_on_page = 0
        for item in page_items:
            if item["ma_tbmt"] in seen_ma_tbmt:
                continue
            seen_ma_tbmt.add(item["ma_tbmt"])
            all_items.append(item)
            new_on_page += 1

        if new_on_page == 0:
            break

    return all_items


def _find_detail_value(soup: BeautifulSoup, label_substring: str) -> str | None:
    for tit in soup.select("div.bidding-detail-item div.c-tit, div.c-tit"):
        if label_substring in tit.text.strip().lower():
            val_div = tit.find_next_sibling("div", class_="c-val") or tit.find_next("div", class_="c-val")
            if val_div:
                val = val_div.text.strip()
                if val:
                    return val
    return None


def _parse_vn_datetime(value: str | None) -> str | None:
    """Parse 'HH:MM dd/mm/YYYY' (as used for both đóng thầu and mở thầu) to ISO."""
    if not value:
        return None
    try:
        return datetime.strptime(value.strip(), "%H:%M %d/%m/%Y").isoformat()
    except Exception:
        return None


def _fetch_detail(item: dict) -> dict:
    time.sleep(random.uniform(0.5, 1.0))  # Tránh rate limit
    try:
        r = requests.get(item["detail_url"], headers=REQUEST_HEADERS, timeout=20)
        if r.status_code == 200:
            s = BeautifulSoup(r.text, "html.parser")

            project_name = _find_detail_value(s, "tên dự án")
            if project_name:
                item["project_name"] = project_name

            khlcnt_a = s.select_one('.c-val a[href^="/kehoach/luachon-nhathau/"]')
            if khlcnt_a:
                item["plan_no"] = khlcnt_a.text.strip()

            mo_thau = _find_detail_value(s, "thời điểm mở thầu")
            item["mo_thau_iso"] = _parse_vn_datetime(mo_thau)

            dang_tai = _find_detail_value(s, "ngày đăng tải")
            item["dang_tai_iso"] = _parse_vn_datetime(dang_tai)

            dia_diem = _find_detail_value(s, "địa điểm thực hiện gói thầu")
            if dia_diem:
                item["locality"] = dia_diem.lstrip("-").strip()
    except Exception:
        pass
    return item


def _fetch_details_concurrently(items: list[dict]) -> list[dict]:
    logger.info(f"[DauThau.Asia] Đang lấy chi tiết cho {len(items)} gói thầu...")
    processed = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=DETAIL_FETCH_WORKERS) as executor:
        futures = [executor.submit(_fetch_detail, item) for item in items]
        for future in concurrent.futures.as_completed(futures):
            processed.append(future.result())
    return processed


def normalize_items(items: list[dict]) -> list[dict]:
    normalized = []
    for item in items:
        ma_tbmt = str(item.get("ma_tbmt") or "").strip()
        title = str(item.get("goi_thau") or "").strip()
        if not ma_tbmt or not title:
            continue

        plan_no = item.get("plan_no")
        normalized.append(
            {
                "external_code": ma_tbmt,
                "title": title,
                "investor": item.get("chu_dau_tu") or None,
                "sector": None,
                "estimated_value": None,
                "currency": "VND",
                "submission_open_date": item.get("mo_thau_iso"),
                "submission_deadline": item.get("dong_thau_iso"),
                "published_at": item.get("dang_tai_iso"),
                "locality": item.get("locality"),
                "description": item.get("project_name") or None,
                "requirements_text": f"Số KHLCNT: {plan_no}" if plan_no else None,
                "source_url": item.get("detail_url") or "https://dauthau.asia",
            }
        )
    return normalized


def search_dauthauasia(keyword: str) -> list[dict]:
    """Tìm gói thầu theo từ khoá trên dauthau.asia, trả về list dict đã chuẩn hoá."""
    items = _fetch_all_pages(keyword)
    if not items:
        return []

    detailed_items = _fetch_details_concurrently(items)
    return normalize_items(detailed_items)
