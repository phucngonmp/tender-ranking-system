"""
Client for freetender.net.

Crawls HTML search result pages by keyword using requests + BeautifulSoup,
extracts total pages from pagination metadata, fetches search result pages
concurrently, collects tender URLs, fetches detail pages, and normalizes
data into standard tender schema.
"""

import concurrent.futures
import logging
import os
import random
import re
import time
from urllib.parse import quote_plus

import requests
from bs4 import BeautifulSoup

from app.freetender.parsers import parse_freetender_detail

logger = logging.getLogger("freetender")

REQUEST_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
}

PAGE_FETCH_WORKERS = 3
DETAIL_FETCH_WORKERS = 5
MAX_PAGES_LIMIT = 30
BASE_URL = "https://freetender.net"

REQUEST_TIMEOUT = int(os.environ.get("FREETENDER_TIMEOUT", "60"))
MAX_RETRIES = 3
RETRY_BACKOFF_FACTOR = 2.0

PAGINATION_REGEX = re.compile(r"Page\s*(\d+)\s*of\s*(\d+)", re.IGNORECASE)


def _extract_total_pages(soup: BeautifulSoup) -> int:
    """Extracts total pages count from pagination indicator like <span class="text-slate-500">Page 1 of 10</span>."""
    for span in soup.find_all("span", class_=lambda c: c and "text-slate-500" in c):
        text = span.get_text(strip=True)
        match = PAGINATION_REGEX.search(text)
        if match:
            try:
                total = int(match.group(2))
                return min(max(total, 1), MAX_PAGES_LIMIT)
            except ValueError:
                pass

    for el in soup.find_all(string=PAGINATION_REGEX):
        match = PAGINATION_REGEX.search(el)
        if match:
            try:
                total = int(match.group(2))
                return min(max(total, 1), MAX_PAGES_LIMIT)
            except ValueError:
                pass

    return 1


def _fetch_search_page(keyword: str, page: int) -> tuple[list[str], int]:
    """Fetches one search result page with retry and returns (list of tender relative URLs, total pages)."""
    encoded_keyword = quote_plus(keyword)
    url = (
        f"{BASE_URL}/?q={encoded_keyword}"
        f"&sector=it-telecom&notice_type=tender"
        f"&page={page}"
    )
    last_exc: Exception | None = None
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            response = requests.get(url, headers=REQUEST_HEADERS, timeout=REQUEST_TIMEOUT)
            if response.status_code == 200:
                soup = BeautifulSoup(response.text, "html.parser")
                total_pages = _extract_total_pages(soup)
                links = [
                    a["href"]
                    for a in soup.find_all("a", href=True)
                    if a["href"].startswith("/tender/")
                ]
                return links, total_pages

            if response.status_code in (429, 500, 502, 503, 504) and attempt < MAX_RETRIES:
                wait_time = RETRY_BACKOFF_FACTOR * attempt
                logger.warning(
                    f"[FreeTender] HTTP {response.status_code} for search page {page}. "
                    f"Retrying {attempt}/{MAX_RETRIES} in {wait_time:.1f}s..."
                )
                time.sleep(wait_time)
                continue

            raise RuntimeError(f"HTTP {response.status_code} on page {page}")
        except (requests.RequestException, TimeoutError) as exc:
            last_exc = exc
            if attempt < MAX_RETRIES:
                wait_time = RETRY_BACKOFF_FACTOR * attempt
                logger.warning(
                    f"[FreeTender] Request error on page {page} ({exc}). "
                    f"Retrying {attempt}/{MAX_RETRIES} in {wait_time:.1f}s..."
                )
                time.sleep(wait_time)
            else:
                logger.error(
                    f"[FreeTender] All {MAX_RETRIES} attempts failed for search page {page}: {exc}"
                )
                raise

    if last_exc:
        raise last_exc
    raise RuntimeError(f"Failed to fetch search page {page}")


def _collect_all_tender_paths(keyword: str) -> list[str]:
    """Discovers total pages on Page 1 and concurrently collects all unique tender paths across all pages."""
    logger.info(f"[FreeTender] Dang kiem tra trang 1 cho tu khoa: '{keyword}'...")
    page_1_links, total_pages = _fetch_search_page(keyword, page=1)

    seen_links: set[str] = set(page_1_links)
    all_links: list[str] = list(page_1_links)

    logger.info(
        f"[FreeTender] Tim thay {total_pages} trang ket qua cho tu khoa '{keyword}'. "
        f"Trang 1 co {len(page_1_links)} goi thau."
    )

    if total_pages <= 1:
        return all_links

    remaining_pages = list(range(2, total_pages + 1))
    logger.info(
        f"[FreeTender] Dang cao song song {len(remaining_pages)} trang con lai "
        f"(tu trang 2 den {total_pages}) voi {PAGE_FETCH_WORKERS} workers..."
    )

    def fetch_page_safe(p: int) -> list[str]:
        time.sleep(random.uniform(0.1, 0.3))
        try:
            links, _ = _fetch_search_page(keyword, p)
            return links
        except Exception as exc:
            logger.warning(f"[FreeTender] Loi cao trang {p}: {exc}")
            return []

    with concurrent.futures.ThreadPoolExecutor(max_workers=PAGE_FETCH_WORKERS) as executor:
        future_to_page = {executor.submit(fetch_page_safe, p): p for p in remaining_pages}
        for future in concurrent.futures.as_completed(future_to_page):
            p = future_to_page[future]
            try:
                page_links = future.result()
                new_links = [l for l in page_links if l not in seen_links]
                seen_links.update(new_links)
                all_links.extend(new_links)
                logger.info(f"[FreeTender] Trang {p}: them {len(new_links)} goi thau moi.")
            except Exception as exc:
                logger.warning(f"[FreeTender] Loi xu ly ket qua trang {p}: {exc}")

    logger.info(f"[FreeTender] Tong cong tim thay {len(all_links)} goi thau duy nhat tren {total_pages} trang.")
    return all_links


def _fetch_detail(tender_path: str) -> dict | None:
    """Fetches and parses a single tender detail page with retry and rate-limiting guard."""
    detail_url = f"{BASE_URL}{tender_path}"
    for attempt in range(1, MAX_RETRIES + 1):
        time.sleep(random.uniform(0.2, 0.5))
        try:
            response = requests.get(detail_url, headers=REQUEST_HEADERS, timeout=REQUEST_TIMEOUT)
            if response.status_code == 200:
                return parse_freetender_detail(response.text, detail_url)
            if response.status_code in (429, 500, 502, 503, 504) and attempt < MAX_RETRIES:
                wait_time = 1.0 * attempt
                time.sleep(wait_time)
                continue
            logger.warning(f"[FreeTender] HTTP {response.status_code} cho {detail_url}")
            return None
        except (requests.RequestException, TimeoutError) as exc:
            if attempt < MAX_RETRIES:
                wait_time = 1.0 * attempt
                time.sleep(wait_time)
                continue
            logger.warning(f"[FreeTender] Loi fetch/parse {detail_url} sau {MAX_RETRIES} lan thu: {exc}")
            return None
        except Exception as exc:
            logger.warning(f"[FreeTender] Loi parse {detail_url}: {exc}")
            return None

    return None


def _fetch_details_concurrently(tender_paths: list[str]) -> list[dict]:
    """Fetches all tender details concurrently using ThreadPoolExecutor."""
    logger.info(f"[FreeTender] Dang lay chi tiet cho {len(tender_paths)} goi thau voi {DETAIL_FETCH_WORKERS} workers...")
    results: list[dict] = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=DETAIL_FETCH_WORKERS) as executor:
        futures = [executor.submit(_fetch_detail, path) for path in tender_paths]
        for idx, future in enumerate(concurrent.futures.as_completed(futures), start=1):
            try:
                result = future.result()
                if result:
                    results.append(result)
                    if idx % 10 == 0 or idx == len(tender_paths):
                        logger.info(f"[FreeTender] Da lay chi tiet ({idx}/{len(tender_paths)}) goi thau...")
            except Exception as exc:
                logger.warning(f"[FreeTender] Loi nhan chi tiet goi thau: {exc}")

    logger.info(f"[FreeTender] Hoan tat lay chi tiet: thanh cong {len(results)}/{len(tender_paths)} goi thau.")
    return results


def search_freetender(keyword: str) -> list[dict]:
    """Search tenders by keyword on FreeTender across all pages, returning normalized dict list."""
    logger.info(f"[FreeTender] Bat dau tim kiem toan bo tu khoa: '{keyword}'")
    tender_paths = _collect_all_tender_paths(keyword)
    if not tender_paths:
        logger.info(f"[FreeTender] Khong tim thay goi thau nao cho tu khoa '{keyword}'")
        return []

    return _fetch_details_concurrently(tender_paths)
