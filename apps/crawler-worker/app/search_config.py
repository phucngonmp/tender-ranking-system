"""
Centralized Advanced Search Configurations for all Crawler Engines.

You can modify search filters, scopes, and scraping behavior for each supported platform here.
Each configuration class uses Pydantic dataclasses / BaseModels for strong typing and validation.
"""

from dataclasses import dataclass, field
from typing import Literal


@dataclass
class GeBizSearchConfig:
    """Advanced Search configuration for GeBIZ Singapore (JavaServer Faces platform)."""
    
    # 1. Search Scope Checkboxes
    search_in_title: bool = True       # Search keyword in Tender Title
    search_in_doc_no: bool = True      # Search keyword in Document / Quotation No.
    search_in_agency: bool = True      # Search keyword in Agency Name
    
    # 2. Match Logic
    match_mode: Literal["Match Any", "Match All"] = "Match Any"
    
    # 3. Category Filter ('All' or specific category name)
    category: str = "All"
    
    # 4. Agency Filter ('All' or specific agency name, e.g. 'Government Technology Agency (GovTech)')
    agency: str = "All"
    
    # 5. Procurement Nature / Type ('All', 'Goods', 'Services', 'Construction')
    procurement_type: str = "All"

    # 6. Opportunity / Document Types Filter
    # 'TQ' = Quotation (Invitation to Quote < $90,000 SGD)
    # 'TT' = Tender (Invitation to Tender > $1,000,000 SGD)
    # 'TL' = Tender Lite (Tender Lite $90,000 - $1,000,000 SGD)
    # 'QT' = Qualification of Tenderers
    # 'EO' = Expression of Interest
    # 'RFI' = Request for Information
    opportunity_types: list[str] = field(default_factory=lambda: ["TQ", "TT", "TL"])
    
    # 7. Status Filter ('ON' = Open tenders only, 'OFF' = All tenders)
    opportunity_status: Literal["ON", "OFF"] = "ON"
    
    # 8. Date Range Presets:
    # '0' = Today
    # '1' = Past 2 days
    # '2' = Past 7 days
    # '3' = Past 14 days
    # '4' = Past 30 days
    # '5' = Past 60 days
    # '6' = Past 90 days
    date_range_preset: str = "6"
    
    # 9. Scraping Concurrency
    max_detail_workers: int = 5
    request_timeout_seconds: int = 25


@dataclass
class BidwinnerSearchConfig:
    """Advanced Search configuration for Bidwinner (JSON API)."""
    
    # Field codes: 1=Hàng hóa, 3=Xây lắp, 10=Tư vấn, 5=Phi tư vấn, 15=Hỗn hợp
    linh_vuc: str = "1,3,10,5,15"
    dia_diem: str = "00"              # 00 = Toàn quốc
    du_toan: str = "0"                # 0 = Mọi mức dự toán
    search_date: str = "openning_bids" # Mở thầu
    htlcnt: str = "all"               # Hình thức lựa chọn nhà thầu: Tất cả
    sort: str = "thoi_diem_dang_tai"  # Sắp xếp theo thời điểm đăng tải
    detail_fetch_workers: int = 10
    request_timeout_seconds: int = 20


@dataclass
class DauThauAsiaSearchConfig:
    """Advanced Search configuration for DauThau.Asia."""
    
    max_pages: int = 30               # Maximum pages to paginate per keyword
    detail_fetch_workers: int = 10
    request_timeout_seconds: int = 15


@dataclass
class MuaSamCongSearchConfig:
    """Advanced Search configuration for MuaSamCong (E-GP Vietnam)."""
    
    page_size: int = 10
    max_pages: int = 10
    request_timeout_seconds: int = 30


# --- Default Active Instances ---
GEBIZ_CONFIG = GeBizSearchConfig()
BIDWINNER_CONFIG = BidwinnerSearchConfig()
DAUTHAUASIA_CONFIG = DauThauAsiaSearchConfig()
MUASAMCONG_CONFIG = MuaSamCongSearchConfig()
