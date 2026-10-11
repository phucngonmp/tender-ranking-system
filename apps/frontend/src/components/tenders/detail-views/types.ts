export interface TenderDetailViewProps {
  description: string | null;
  requirementsText: string | null;
  currency?: string | null;
  sourceType?: string;
}

export interface FreetenderMeta {
  reference?: string;
  location?: string;
  sector?: string;
  type?: string;
  published?: string;
  closes?: string;
  issuer?: string;
  source_portal?: string;
  naics?: string;
  psc?: string;
  solicitation_number?: string;
}

export interface FreetenderStructuredPayload {
  _format: string;
  title?: string;
  summary?: string;
  full_details?: string;
  meta?: FreetenderMeta;
  official_url?: string;
  freetender_url?: string;
}

export interface GebizContact {
  name?: string;
  email?: string;
  phone?: string;
  fax?: string;
  address?: string;
}

export interface GebizSiteBriefing {
  attendance_compulsory?: string;
  briefing_date?: string;
  briefing_time?: string;
  venue?: string;
  remarks?: string;
}

export interface GebizSpecs {
  tender_no?: string;
  reference_no?: string;
  agency?: string;
  published?: string;
  offer_validity?: string;
  procurement_type?: string;
  two_envelope_bidding?: string;
  tender_type?: string;
  wto_gpa?: string;
  procurement_nature?: string;
  procurement_method?: string;
  request_for_proposal?: string;
  gra_work_heads?: string;
  procurement_category?: string;
}

export interface GebizDeliveryRecord {
  sn?: string;
  location?: string;
  delivery_date?: string;
  quantity?: string;
  delivery_terms?: string;
}

export interface GebizLineItem {
  item_number?: string;
  header?: string;
  mandatory_to_bid?: string;
  title?: string;
  description?: string;
  quantity?: string;
  uom?: string;
  remarks?: string;
  delivery_records?: GebizDeliveryRecord[];
}

export interface GebizStructuredPayload {
  _format?: string;
  title?: string;
  gra_label?: string;
  contact?: GebizContact;
  site_briefing?: GebizSiteBriefing;
  specs?: GebizSpecs;
  base_requirements?: string;
  line_items?: GebizLineItem[];
  delivery_info?: GebizDeliveryRecord[];
}

export interface SamgovMeta {
  solicitation_number?: string;
  notice_type?: string;
  department?: string;
  location?: string;
  sector?: string;
  published?: string;
  closes?: string;
  naics?: string;
  psc?: string;
  contacts?: string;
  set_aside?: string;
}

export interface SamgovStructuredPayload {
  _format: string;
  title?: string;
  solicitation_number?: string;
  opportunity_id?: string;
  summary?: string;
  full_details?: string;
  meta?: SamgovMeta;
  source_url?: string;
}
