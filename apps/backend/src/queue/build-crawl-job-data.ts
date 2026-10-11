import { Source, SourceType } from '@prisma/client';
import { CrawlJobData } from './queue.constants';

export function buildCrawlJobData(source: Source, crawlJobId: string): CrawlJobData {
  if (source.sourceType === SourceType.url) {
    return { mode: 'url', crawlJobId, sourceId: source.id, url: source.url! };
  }
  return {
    mode: source.sourceType,
    crawlJobId,
    sourceId: source.id,
    keyword: source.keyword!,
  };
}
