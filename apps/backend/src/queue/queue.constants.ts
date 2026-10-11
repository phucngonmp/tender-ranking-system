import { SourceType } from '@prisma/client';

export const CRAWL_QUEUE = 'crawl';
export const SCORING_QUEUE = 'scoring';
export const FILE_DOWNLOAD_QUEUE = 'file-download';
export const CLOSED_TENDER_QUEUE = 'closed-tender-crawl';

export type KeywordSourceType = Exclude<SourceType, 'url'>;

/** Crawler-worker path for each keyword-based source type. */
export const KEYWORD_SOURCE_ENDPOINTS: Record<KeywordSourceType, string> = {
  muasamcong_keyword: '/muasamcong/search',
  bidwinner_keyword: '/bidwinner/search',
  dauthauasia_keyword: '/dauthauasia/search',
  gebiz_keyword: '/gebiz/search',
  freetender_keyword: '/freetender/search',
  samgov_keyword: '/samgov/search',
};

export type CrawlJobData =
  | { mode: 'url'; crawlJobId: string; sourceId: string; url: string }
  | { mode: KeywordSourceType; crawlJobId: string; sourceId: string; keyword: string };

export interface ScoringJobData {
  tenderId: string;
}

export interface FileDownloadJobData {
  attachmentId: string;
  tenderId: string;
  originalUrl: string;
  fileName: string;
}

export interface ClosedTenderJobData {
  crawlJobId: string;
  keywordId: string;
  keyword: string;
}
