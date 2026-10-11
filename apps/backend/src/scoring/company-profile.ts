/** Hồ sơ năng lực công ty dùng để đối chiếu — tham số hóa để tái dùng cho nhiều công ty/khách hàng. */
export interface CompanyProfile {
  name: string;
  positioning: string;
  services: string[];
  productsAndSolutions: string[];
  industriesExperience: string[];
  certifications: string[];
  marketsAndLanguages: string[];
  deliveryModel: string;
}

/** Hồ sơ mẫu mặc định cho hệ thống. Người dùng có thể cấu hình hồ sơ cụ thể trong Criteria Profile. */
export const DEFAULT_COMPANY_PROFILE: CompanyProfile = {
  name: 'Global Tech Solutions Corp',
  positioning:
    'Nhà cung cấp giải pháp chuyển đổi số toàn diện và dịch vụ kỹ thuật phần mềm chất lượng cao.',
  services: [
    'Tư vấn & Phát triển giải pháp Chuyển đổi số (DX)',
    'Kỹ thuật phần mềm & Gia công phần mềm xuất khẩu',
    'Tích hợp hệ thống & Cloud Engineering',
    'Tư vấn & Triển khai giải pháp AI / Machine Learning',
  ],
  productsAndSolutions: [
    'Hệ thống quản trị doanh nghiệp (ERP / CRM / HRM)',
    'Nền tảng Generative AI & Tự động hóa quy trình',
    'Cổng thông tin điện tử & Nền tảng thương mại điện tử',
    'Ứng dụng di động & Web đa nền tảng',
    'Giải pháp dữ liệu lớn (Big Data / Data Analytics)',
  ],
  industriesExperience: [
    'Công nghệ thông tin & Viễn thông',
    'Y tế & Giáo dục số',
    'Tài chính & Ngân hàng số',
    'Giao thông, Hậu cần & Xây dựng',
    '+10 ngành nghề lĩnh vực công',
  ],
  certifications: [
    'ISO 9001 (Hệ thống quản lý chất lượng)',
    'ISO/IEC 27001 (An toàn thông tin)',
    'CMMI Level 3',
    'Chứng chỉ Đối tác Cloud (AWS / Azure / GCP)',
  ],
  marketsAndLanguages: [
    'Việt Nam',
    'Châu Á - Thái Bình Dương (APAC)',
    'Bắc Mỹ & Châu Âu',
    'Hỗ trợ đa ngôn ngữ (Tiếng Anh, Tiếng Việt, Tiếng Nhật)',
  ],
  deliveryModel:
    'Mô hình Agile / DevOps hiện đại, chuyển giao trọn gói (Turnkey/End-to-End) hoặc Dedicated Team.',
};
