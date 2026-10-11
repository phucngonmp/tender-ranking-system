// Tender fields eligible as targetField for numeric_range/list_match tiers,
// plus the virtual "requirements_and_description" field (see criteria-scoring.util.ts).
export const ALLOWED_TARGET_FIELDS = [
  { value: 'estimatedValue', label: 'Giá trị dự toán', kind: 'numeric' },
  { value: 'locality', label: 'Địa phương', kind: 'text' },
  { value: 'investor', label: 'Chủ đầu tư', kind: 'text' },
  { value: 'sector', label: 'Lĩnh vực', kind: 'text' },
  { value: 'title', label: 'Tên gói thầu', kind: 'text' },
  { value: 'requirements_and_description', label: 'Yêu cầu + Mô tả', kind: 'text' },
] as const;

export type AllowedTargetField = (typeof ALLOWED_TARGET_FIELDS)[number]['value'];

// Fixed set of AI-judged classification questions — kept in code (not admin-
// extendable) since OpenAI's structured-output schema for these is static.
// Admin can only edit the points/label/description of each tier value below,
// not add a new question dimension.
export const ALLOWED_AI_QUESTION_KEYS = [
  { value: 'project_type', label: 'Loại dự án (đúng/sai)', valueType: 'boolean' },
  {
    value: 'domain_bucket',
    label: 'Nghiệp vụ',
    valueType: 'enum',
    enumValues: [
      'admin_hr_realestate_manufacturing_service_tourism',
      'transport_construction_health',
      'security_defense',
      'other',
    ],
  },
  { value: 'bid_guarantee_under_100tr', label: 'Bảo lãnh dự thầu < 100 triệu', valueType: 'boolean' },
] as const;

export type AllowedAiQuestionKey = (typeof ALLOWED_AI_QUESTION_KEYS)[number]['value'];
