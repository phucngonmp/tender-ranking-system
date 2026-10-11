export type RoleName = 'admin' | 'member';

export interface User {
  id: string;
  email: string;
  fullName: string;
  role: RoleName;
  isActive: boolean;
  receiveEmails?: boolean;
  createdAt?: string;
}

export type SourceType =
  | 'url'
  | 'muasamcong_keyword'
  | 'bidwinner_keyword'
  | 'dauthauasia_keyword'
  | 'gebiz_keyword'
  | 'freetender_keyword'
  | 'samgov_keyword';

export interface Source {
  id: string;
  name: string;
  sourceType: SourceType;
  url: string | null;
  keyword: string | null;
  minValue: string | null;
  maxValue: string | null;
  isActive: boolean;
  autoScore?: boolean;
  crawlHour: number;
  lastCrawledAt: string | null;
  createdAt: string;
}

export interface CriteriaProfile {
  id: string;
  name: string;
  industries: string[];
  technologies: string[];
  products: string[];
  keywords: string[];
  preferredValueMin: number | null;
  preferredValueMax: number | null;
  positioning: string | null;
  services: string[];
  productsAndSolutions: string[];
  industriesExperience: string[];
  certifications: string[];
  marketsAndLanguages: string[];
  deliveryModel: string | null;
  isActive: boolean;
  updatedAt: string;
}

export type TenderVerdict = 'GO' | 'CONSIDER' | 'NO_GO';

export interface CriterionOutcome {
  groupId: string;
  groupName: string;
  points: number;
  label: string;
  reasons?: string[];
}

export interface RubricClassification {
  isDxProject: boolean;
  domainBucket: string;
  bidGuaranteeMentioned: boolean;
  bidGuaranteeUnder100tr: boolean;
}

export interface RubricBreakdown {
  groups: CriterionOutcome[];
  classification: RubricClassification;
}

export type ScoringEvaluatorType = 'numeric_range' | 'list_match' | 'date_diff_gte' | 'ai_classification';
export type ScoringAggregation = 'best_tier' | 'flat_if_any';

export interface ScoringCriteriaTier {
  id: string;
  groupId: string;
  label: string;
  points: number;
  order: number;
  evaluatorType: ScoringEvaluatorType;
  targetField: string | null;
  aiQuestionKey: string | null;
  config: Record<string, any>;
}

export interface ScoringCriteriaGroup {
  id: string;
  name: string;
  description: string | null;
  order: number;
  isActive: boolean;
  aggregation: ScoringAggregation;
  bonusPoints: number | null;
  tiers: ScoringCriteriaTier[];
  updatedAt: string;
}

export interface ScoringFieldOption {
  value: string;
  label: string;
  kind: string;
}

export interface ScoringAiQuestionOption {
  value: string;
  label: string;
  valueType: 'boolean' | 'enum';
  enumValues?: string[];
}

export interface ScoringFieldMetadata {
  targetFields: ScoringFieldOption[];
  aiQuestionKeys: ScoringAiQuestionOption[];
}

export interface TenderListItem {
  id: string;
  source_id: string;
  source_name: string;
  source_keyword: string | null;
  external_code: string | null;
  title: string;
  investor: string | null;
  sector: string | null;
  estimated_value: string | null;
  currency: string | null;
  submission_open_date: string | null;
  submission_deadline: string | null;
  published_at: string | null;
  locality: string | null;
  source_url: string;
  first_seen_at: string;
  last_updated_at: string;
  final_score: number | null;
  ai_score: number | null;
  verdict: TenderVerdict | null;
  scored_at: string | null;
  rubric_score: number | null;
  rubric_breakdown: RubricBreakdown | null;
}

export interface TenderScore {
  id: string;
  tenderId: string;
  criteriaProfileId: string;
  aiScore: number;
  verdict: TenderVerdict;
  aiRationale: string;
  matchedCriteria: string[];
  gaps: string[];
  riskFlags: string[];
  recommendedFocus: string[];
  ruleScore: number;
  finalScore: number;
  rubricScore: number | null;
  rubricBreakdown: RubricBreakdown | null;
  modelUsed: string;
  scoredAt: string;
}

export interface TenderDetail {
  id: string;
  sourceId: string;
  externalCode: string | null;
  title: string;
  investor: string | null;
  sector: string | null;
  estimatedValue: string | null;
  currency: string | null;
  submissionOpenDate: string | null;
  submissionDeadline: string | null;
  publishedAt: string | null;
  locality: string | null;
  description: string | null;
  requirementsText: string | null;
  sourceUrl: string;
  firstSeenAt: string;
  lastUpdatedAt: string;
  source: { id: string; name: string; url: string; sourceType?: SourceType };
  scores: TenderScore[];
  attachments: TenderAttachment[];
  emailHistories?: TenderEmailHistory[];
}

export interface TenderAttachment {
  id: string;
  tenderId: string;
  fileName: string;
  originalUrl: string;
  documentType: string;
  storagePath?: string | null;
  fileSize: number | null;
  createdAt: string;
}

export interface EmailDigestSetting {
  id: number;
  recipients: string[];
  isEnabled: boolean;
  sendHour: number;
  sendMinute: number;
  minScore: number | null;
  topCount: number;
  lastSentAt: string | null;
  updatedAt: string;
}

export type CrawlJobStatus = 'pending' | 'running' | 'success' | 'failed';

export interface CrawlJob {
  id: string;
  sourceId: string;
  status: CrawlJobStatus;
  itemsFound: number;
  errorMessage: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  source: { id: string; name: string };
}

export interface PaginatedResult<T> {
  data: T[];
  pagination: { page: number; limit: number; total: number };
}

export interface ClosedTenderKeyword {
  id: string;
  sourceId: string | null;
  source: { id: string; name: string } | null;
  keyword: string;
  isActive: boolean;
  crawlHour: number;
  lastCrawledAt: string | null;
  createdAt: string;
}

export interface ClosedTenderCrawlJob {
  id: string;
  keywordId: string;
  status: CrawlJobStatus;
  itemsFound: number;
  errorMessage: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  keyword: { id: string; keyword: string };
}

export type ClosedTenderStatus = 'under_evaluation' | 'awarded';

export interface ClosedTenderBidder {
  id: string;
  resultId: string;
  orgCode: string | null;
  orgFullname: string;
  taxCode: string | null;
  bidPrice: string | null;
  finalPrice: string | null;
  isWinner: boolean;
  winningPrice: string | null;
  rankOrReason: string | null;
  executionTime: string | null;
  contractPeriodText: string | null;
  createdAt: string;
}

export interface ClosedTenderResult {
  id: string;
  keywordId: string;
  notifyNo: string;
  notifyId: string | null;
  inputResultId: string | null;
  matchedKeyword: string | null;
  title: string;
  investor: string | null;
  investorCode: string | null;
  bidField: string | null;
  locality: string | null;
  estimatedValue: string | null;
  bidCloseDate: string | null;
  bidOpenDate: string | null;
  status: ClosedTenderStatus;
  numBidderJoin: number | null;
  decisionNo: string | null;
  decisionDate: string | null;
  decisionAgency: string | null;
  decisionFileId: string | null;
  decisionFileName: string | null;
  winningContractorNames: string[];
  winningPrice: string | null;
  sourceUrl: string;
  firstSeenAt: string;
  lastUpdatedAt: string;
  keyword: { id: string; keyword: string };
  _count?: { bidders: number };
  bidders?: ClosedTenderBidder[];
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

export interface ClosedTenderStatsSummary {
  totalTenders: number;
  awardedTenders: number;
  underEvaluationTenders: number;
  totalWinningValue: string;
  totalCompanies: number;
}

export interface DataFreshness {
  lastCrawledAt: string | null;
}

export interface ClosedTenderKeywordStat {
  keywordId: string;
  keyword: string;
  totalCount: number;
  awardedCount: number;
  underEvaluationCount: number;
  totalWinningValue: string;
}

export interface ClosedTenderCompanyStat {
  companyKey: string;
  taxCode: string | null;
  orgFullname: string;
  bidCount: number;
  winCount: number;
  winRate: number;
  totalWinningValue: string;
  keywordCount: number;
}

export interface ClosedTenderCompanyProfile extends ClosedTenderCompanyStat {
  keywords: string[];
}

export interface ClosedTenderCompanyTender {
  id: string;
  notifyNo: string;
  title: string;
  investor: string | null;
  status: ClosedTenderStatus;
  keyword: string;
  bidPrice: string | null;
  finalPrice: string | null;
  isWinner: boolean;
  winningPrice: string | null;
  rankOrReason: string | null;
  bidCloseDate: string | null;
}

export type CompetitorThreatLevel = 'low' | 'medium' | 'high';

export interface CompetitorAssessmentSource {
  url: string;
  title: string;
}

export interface CompetitorAssessment {
  id: string;
  companyKey: string;
  taxCode: string | null;
  orgFullname: string;
  threatLevel: CompetitorThreatLevel;
  companySummary: string;
  strengths: string[];
  weaknesses: string[];
  overlapWithUs: string | null;
  recommendations: string[];
  fullAnalysis: string;
  sources: CompetitorAssessmentSource[];
  modelUsed: string;
  promptTokens: number | null;
  completionTokens: number | null;
  totalTokens: number | null;
  requestedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TenderEmailHistory {
  id: string;
  tenderId: string;
  recipient: string;
  subject: string;
  status: 'success' | 'failed';
  errorMsg: string | null;
  sentAt: string;
  tender?: { id: string; title: string } | null;
}

export interface NotificationConfig {
  id: number;
  emailsEnabled: boolean;
  emailRecipients: string[];
  webhookEnabled: boolean;
  webhookUrl: string | null;
  webhookType: string | null;
  minScoreThreshold: number;
  allowedVerdicts: TenderVerdict[];
  includeAttachments: boolean;
  includeAiAnalysis: boolean;
  updatedAt: string;
}

export interface RecipientStat {
  email: string;
  type: 'internal' | 'external';
  successCount: number;
  failedCount: number;
}

export type ScoringStatus = 'pending' | 'success' | 'failed';

export interface ScoringHistory {
  id: string;
  tenderId: string;
  status: ScoringStatus;
  modelUsed: string | null;
  score: number | null;
  promptTokens: number | null;
  completionTokens: number | null;
  totalTokens: number | null;
  errorMessage: string | null;
  startedAt: string;
  finishedAt: string | null;
  tender: { id: string; title: string } | null;
}
