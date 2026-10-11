from typing import Optional

from pydantic import BaseModel


class CrawlRequest(BaseModel):
    source_id: str
    crawl_job_id: str
    url: str
    callback_url: str


class KeywordSearchRequest(BaseModel):
    source_id: str
    crawl_job_id: str
    keyword: str
    callback_url: str


class ClosedTenderSearchRequest(BaseModel):
    keyword_id: str
    crawl_job_id: str
    keyword: str
    callback_url: str


class RawTenderItem(BaseModel):
    external_code: Optional[str] = None
    matched_keyword: Optional[str] = None
    title: str
    investor: Optional[str] = None
    sector: Optional[str] = None
    estimated_value: Optional[float] = None
    currency: Optional[str] = None
    submission_open_date: Optional[str] = None
    submission_deadline: Optional[str] = None
    published_at: Optional[str] = None
    locality: Optional[str] = None
    description: Optional[str] = None
    requirements_text: Optional[str] = None
    source_url: str
    
    # Dữ liệu Webform và File vật lý
    hsmt_data: Optional[dict] = None
    attachments: Optional[list[dict]] = None
