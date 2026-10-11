import { createHash } from 'crypto';
import { RawTenderItemDto } from './dto/crawl-callback.dto';

/**
 * Fingerprints a tender's substantive content. Tenders are identified across
 * crawls by external_code (mã gói thầu); this hash instead tells us whether
 * that tender's content actually changed since we last saw it, so unchanged
 * re-crawls skip the update-and-rescore path.
 */
export function computeContentHash(item: RawTenderItemDto): string {
  const normalized = [
    item.external_code ?? '',
    item.title.trim().toLowerCase(),
    item.investor?.trim().toLowerCase() ?? '',
    item.estimated_value ?? '',
    item.submission_open_date ?? '',
    item.submission_deadline ?? '',
    item.locality?.trim().toLowerCase() ?? '',
    item.description?.trim().toLowerCase() ?? '',
    item.requirements_text?.trim().toLowerCase() ?? '',
  ].join('|');

  return createHash('sha256').update(normalized).digest('hex');
}
