import { Injectable, Logger } from '@nestjs/common';
import { CrawlJobStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ScoringQueueService } from '../queue/scoring-queue.service';
import { CrawlCallbackDto, RawTenderItemDto } from './dto/crawl-callback.dto';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { computeContentHash } from './content-hash.util';
import { FileDownloadQueueService } from '../queue/file-download-queue.service';
import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';
import * as https from 'https';

type UpsertResult = 'new' | 'updated' | 'unchanged';

/**
 * In-memory store for the MuaSamCong session token pushed by the Python crawler.
 * This is intentionally process-scoped (not persisted to DB) — the crawler
 * refreshes it automatically and will push a new one when it restarts.
 */
let _muasamcongToken: string | null = null;
let _muasamcongCookies: Record<string, string>[] = [];

@Injectable()
export class InternalService {
  private readonly logger = new Logger(InternalService.name);

  constructor(
    private prisma: PrismaService,
    private scoringQueue: ScoringQueueService,
    private fileDownloadQueue: FileDownloadQueueService,
  ) { }

  async handleCrawlCallback(dto: CrawlCallbackDto) {
    const now = new Date();

    if (dto.status === 'failed') {
      await this.prisma.crawlJob.update({
        where: { id: dto.crawl_job_id },
        data: {
          status: CrawlJobStatus.failed,
          errorMessage: dto.error_message ?? 'Unknown crawler error',
          finishedAt: now,
        },
      });
      await this.prisma.source.update({
        where: { id: dto.source_id },
        data: { lastCrawledAt: now },
      });
      return { accepted: true };
    }

    const source = await this.prisma.source.findUnique({ where: { id: dto.source_id } });
    const minValue = source?.minValue ? Number(source.minValue) : null;
    const maxValue = source?.maxValue ? Number(source.maxValue) : null;

    const items = (dto.items ?? []).filter((item) => this.isWithinValueRange(item, minValue, maxValue));
    const skippedCount = (dto.items?.length ?? 0) - items.length;
    let newCount = 0;
    let updatedCount = 0;

    const shouldAutoScore = source?.autoScore ?? true;

    for (const item of items) {
      const result = await this.upsertTender(dto.source_id, item, shouldAutoScore);
      if (result === 'new') newCount += 1;
      if (result === 'updated') updatedCount += 1;
    }

    await this.prisma.crawlJob.update({
      where: { id: dto.crawl_job_id },
      data: {
        status: CrawlJobStatus.success,
        itemsFound: items.length,
        finishedAt: now,
      },
    });
    await this.prisma.source.update({
      where: { id: dto.source_id },
      data: { lastCrawledAt: now },
    });

    this.logger.log(
      `Crawl job ${dto.crawl_job_id}: ${items.length} items found, ${newCount} new, ${updatedCount} updated` +
        (skippedCount > 0 ? `, ${skippedCount} skipped (ngoài ngưỡng giá trị)` : ''),
    );

    return { accepted: true, newCount, updatedCount };
  }

  /** Ngưỡng giá trị gói thầu (VND) cấu hình trên Source — không set (null) thì lấy tất cả.
   * Gói thầu chưa xác định được giá trị vẫn được giữ lại (không đủ căn cứ để loại). */
  private isWithinValueRange(
    item: RawTenderItemDto,
    minValue: number | null,
    maxValue: number | null,
  ): boolean {
    if (minValue === null && maxValue === null) return true;
    if (item.estimated_value === undefined || item.estimated_value === null) return true;
    if (minValue !== null && item.estimated_value < minValue) return false;
    if (maxValue !== null && item.estimated_value > maxValue) return false;
    return true;
  }

  /**
   * Tenders are identified across crawls (and across sources — MuaSamCong,
   * Bidwinner and DauThau.Asia largely mirror the same official listings) by
   * external_code (mã gói thầu), not by row content. A matching external_code
   * updates the existing row in place instead of creating a duplicate; a
   * changed content_hash on that existing row means something substantive
   * changed (deadline moved, price updated, ...) and triggers re-scoring.
   */
  private async upsertTender(sourceId: string, item: RawTenderItemDto, shouldAutoScore = true): Promise<UpsertResult> {
    const contentHash = computeContentHash(item);

    const existing = item.external_code
      ? await this.prisma.tender.findFirst({ where: { externalCode: item.external_code } })
      : await this.prisma.tender.findFirst({ where: { contentHash } });

    const data = {
      externalCode: item.external_code,
      matchedKeyword: item.matched_keyword,
      title: item.title,
      investor: item.investor,
      sector: item.sector,
      estimatedValue: item.estimated_value,
      currency: item.currency ?? 'VND',
      submissionOpenDate: item.submission_open_date ? new Date(item.submission_open_date) : null,
      submissionDeadline: item.submission_deadline ? new Date(item.submission_deadline) : null,
      publishedAt: item.published_at ? new Date(item.published_at) : null,
      locality: item.locality,
      description: item.description,
      requirementsText: item.requirements_text,
      sourceUrl: item.source_url,
      contentHash,
    };

    if (!existing) {
      const tender = await this.prisma.tender.create({ data: { sourceId, ...data } });
      await this.saveTenderAttachments(tender.id, item);
      if (shouldAutoScore) {
        await this.scoringQueue.enqueue({ tenderId: tender.id });
      }
      return 'new';
    }

    if (existing.contentHash === contentHash) {
      return 'unchanged';
    }

    await this.prisma.tender.update({ where: { id: existing.id }, data });
    await this.saveTenderAttachments(existing.id, item);
    await this.scoringQueue.enqueue({ tenderId: existing.id });
    return 'updated';
  }

  private extractHsmtAttachments(obj: any, results: any[] = []): any[] {
    if (!obj) return results;
    if (Array.isArray(obj)) {
      for (const child of obj) {
        this.extractHsmtAttachments(child, results);
      }
    } else if (typeof obj === 'object') {
      // Scan all known key-prefix patterns used by the muasamcong API:
      // standard: fileId/fileName
      // contract-doc: contractFileId/contractFileName
      // attach: attachFileId/attachFileName
      // decision: decisionFileId/decisionFileName
      // brief/other variants in bidInvContractorOfflineDTO
      const prefixes = ['', 'contract', 'attach', 'decision', 'other', 'brief'];
      for (const prefix of prefixes) {
        const idKey = prefix ? `${prefix}FileId` : 'fileId';
        const nameKey = prefix ? `${prefix}FileName` : 'fileName';
        if (obj[idKey] && obj[nameKey] && typeof obj[idKey] === 'string' && obj[idKey].length > 10) {
          results.push({ fileId: obj[idKey], fileName: obj[nameKey] });
        }
      }

      // Also handle numbered variants like otherFileId1..5, otherFileIdEn1..5
      for (let i = 1; i <= 5; i++) {
        for (const variant of ['other', 'otherEn', 'decision']) {
          const idKey = `${variant}FileId${i}`;
          const nameKey = `${variant}FileName${i}`;
          if (obj[idKey] && obj[nameKey] && typeof obj[idKey] === 'string' && obj[idKey].length > 10) {
            results.push({ fileId: obj[idKey], fileName: obj[nameKey] });
          }
        }
      }
      
      // Extract UUIDs from sharedFiles
      if (Array.isArray(obj.sharedFiles)) {
        for (const fileId of obj.sharedFiles) {
          if (typeof fileId === 'string' && fileId.length > 10) {
            results.push({ fileId, fileName: `Unknown_File_${fileId.substring(0, 8)}` });
          }
        }
      }

      if (obj.formValue && typeof obj.formValue === 'string') {
        try {
          const parsed = JSON.parse(obj.formValue);
          this.extractHsmtAttachments(parsed, results);
        } catch (e) { }
      }
      if (obj.listOtherFile && typeof obj.listOtherFile === 'string') {
        try {
          const parsed = JSON.parse(obj.listOtherFile);
          this.extractHsmtAttachments(parsed, results);
        } catch (e) { }
      }
      if (obj.listOtherFileEn && typeof obj.listOtherFileEn === 'string') {
        try {
          const parsed = JSON.parse(obj.listOtherFileEn);
          this.extractHsmtAttachments(parsed, results);
        } catch (e) { }
      }
      for (const key of Object.keys(obj)) {
        this.extractHsmtAttachments(obj[key], results);
      }
    }
    return results;
  }

  /** Called by the Python crawler to share the current MSC session token. */
  setMuasamcongToken(token: string, cookies: Record<string, string>[] = []) {
    _muasamcongToken = token;
    _muasamcongCookies = cookies;
    this.logger.log('[Token] MuaSamCong token updated by crawler');
  }

  /** Returns the current cached MSC token (may be null if crawler never pushed one). */
  getMuasamcongToken(): { token: string | null; cookies: Record<string, string>[] } {
    return { token: _muasamcongToken, cookies: _muasamcongCookies };
  }

  private async triggerTokenRefresh(): Promise<{ token: string | null; cookies: Record<string, string>[] }> {
    const crawlerUrl = process.env.CRAWLER_WORKER_URL || 'http://crawler-worker:8000';
    const internalToken = process.env.INTERNAL_API_TOKEN || '';
    try {
      this.logger.log('[Token] Requesting crawler to refresh token synchronously...');
      const res = await axios.post(`${crawlerUrl}/muasamcong/refresh-token`, {}, {
        headers: { 'x-internal-token': internalToken },
        timeout: 120000 // Browser startup can take a while
      });
      if (res.data && res.data.token) {
        this.setMuasamcongToken(res.data.token, res.data.cookies || []);
        return { token: res.data.token, cookies: res.data.cookies || [] };
      }
    } catch (e) {
      this.logger.error(`[Token] Failed to refresh token from crawler: ${e.message}`);
    }
    return { token: null, cookies: [] };
  }

  private _dedupeAttachments(raw: any[]): any[] {
    const unique = new Map<string, any>();
    for (const a of raw) {
      const existing = unique.get(a.fileId);
      if (!existing || (existing.fileName.startsWith('Unknown_File_') && !a.fileName.startsWith('Unknown_File_'))) {
        unique.set(a.fileId, a);
      }
    }
    return Array.from(unique.values());
  }

  private async saveTenderAttachments(tenderId: string, item: RawTenderItemDto) {
    if (item.__notifyId__) {
      let attachmentsFound = false;
      const proxyUrl = process.env.HTTP_PROXY || process.env.HTTPS_PROXY;
      const agent = proxyUrl
        ? new HttpsProxyAgent(proxyUrl, {
            rejectUnauthorized: false,
            ciphers: 'DEFAULT:@SECLEVEL=1',
          })
        : new https.Agent({
            rejectUnauthorized: false,
            ciphers: 'DEFAULT:@SECLEVEL=1',
          });

      const getRandomBrowserHeaders = () => {
        const profiles = [
          {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            'Sec-Ch-Ua': '"Chromium";v="122", "Not(A:Brand";v="24", "Google Chrome";v="122"',
            'Sec-Ch-Ua-Platform': '"Windows"',
          },
          {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
            'Sec-Ch-Ua': '"Not A(Brand";v="99", "Chromium";v="121", "Google Chrome";v="121"',
            'Sec-Ch-Ua-Platform': '"Windows"',
          },
          {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 Edg/122.0.0.0',
            'Sec-Ch-Ua': '"Chromium";v="122", "Not(A:Brand";v="24", "Microsoft Edge";v="122"',
            'Sec-Ch-Ua-Platform': '"Windows"',
          },
          {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            'Sec-Ch-Ua': '"Chromium";v="122", "Not(A:Brand";v="24", "Google Chrome";v="122"',
            'Sec-Ch-Ua-Platform': '"macOS"',
          },
          {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Sec-Ch-Ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
            'Sec-Ch-Ua-Platform': '"Windows"',
          },
        ];
        const selected = profiles[Math.floor(Math.random() * profiles.length)];
        return {
          'Content-Type': 'application/json',
          'Accept': 'application/json, text/plain, */*',
          'Accept-Language': 'vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7',
          'Sec-Ch-Ua-Mobile': '?0',
          'Sec-Fetch-Dest': 'empty',
          'Sec-Fetch-Mode': 'cors',
          'Sec-Fetch-Site': 'same-origin',
          'Connection': 'keep-alive',
          ...selected,
        };
      };

      // --- PRIMARY API: lcnt_tbmt_hsmt (Requires Token) ---
      let { token, cookies } = this.getMuasamcongToken();
      let retryWithNewToken = false;
      
      const tryFetchHsmt = async (currentToken: string, currentCookies: Record<string, string>[]) => {
        try {
          const url = `https://muasamcong.mpi.gov.vn/o/egp-portal-contractor-selection-v2/services/lcnt_tbmt_hsmt?token=${currentToken}`;
          const cookieHeader = currentCookies.map(c => `${c.name}=${c.value}`).join('; ');
          const rb = await axios.post(
            url,
            { id: item.__id__ || item.__notifyId__, processApply: item.__processApply__ || '' },
            {
              httpsAgent: agent,
              timeout: 20000,
              headers: {
                ...getRandomBrowserHeaders(),
                ...(cookieHeader ? { Cookie: cookieHeader } : {}),
              },
            },
          );
          if (rb.data) {
            // Check if response contains expected data structure, else token might be invalid
            if (typeof rb.data === 'string' && rb.data.includes('<html')) {
              throw new Error('Received HTML instead of JSON, token likely expired');
            }
            item.hsmt_data = { backupHsmt: rb.data };
            const raw = this.extractHsmtAttachments(rb.data);
            item.attachments = this._dedupeAttachments(raw);
            if (item.attachments.length > 0) attachmentsFound = true;
            return true;
          }
        } catch (err) {
          this.logger.warn(`[Primary API] lcnt_tbmt_hsmt failed for ${item.__notifyId__}: ${err.message}`);
          retryWithNewToken = true;
        }
        return false;
      };

      if (!token) {
         retryWithNewToken = true;
      } else {
         const success = await tryFetchHsmt(token, cookies);
         // If failed but didn't throw (e.g. unexpected JSON), retry isn't strictly set unless we caught an error.
         // However, if we didn't find attachments, it might just be a tender with no files.
      }

      if (retryWithNewToken) {
        this.logger.log(`[Primary API] Token invalid or empty for ${item.__notifyId__}, requesting new token...`);
        const refreshed = await this.triggerTokenRefresh();
        if (refreshed.token) {
          await tryFetchHsmt(refreshed.token, refreshed.cookies);
        }
      }

      // --- BACKUP API: bido-inv-biddings-sign (No token needed, public API) ---
      if (!attachmentsFound) {
        this.logger.log(`[Backup API] Primary returned 0 files for ${item.__notifyId__}, falling back to public API...`);
        try {
          const url = 'https://muasamcong.mpi.gov.vn/api/unau/portal/ebidinv/bido-inv-biddings-sign';
          const payload = {
            body: {
              notifyId: item.__notifyId__,
              bidField: item.__bidField__ || 'XL',
            }
          };
          const r = await axios.post(url, payload, {
            httpsAgent: agent,
            timeout: 20000,
            headers: getRandomBrowserHeaders()
          });
          if (r.data && r.data.body) {
            item.hsmt_data = { ...(item.hsmt_data || {}), bidoInvBiddingDTO: r.data.body };
            const rawAttachments = this.extractHsmtAttachments(r.data.body);
            item.attachments = this._dedupeAttachments(rawAttachments);
            this.logger.log(`[Backup API] Got ${item.attachments.length} file(s) for ${item.__notifyId__}`);
          }
        } catch (err) {
          this.logger.error(`[Backup API] Failed to fetch HSMT data for ${item.__notifyId__}: ${err.message}`);
        }
      }
    }

    const storageDir = path.join(process.cwd(), 'storage', 'tenders', tenderId);

    // 1. Save Webform Data as JSON file if it exists
    if (item.hsmt_data) {
      try {
        if (!fs.existsSync(storageDir)) {
          fs.mkdirSync(storageDir, { recursive: true });
        }
        const webformPath = path.join(storageDir, 'webform.json');
        fs.writeFileSync(webformPath, JSON.stringify(item.hsmt_data, null, 2), 'utf-8');

        // Ensure webform attachment record exists
        const existingWebform = await this.prisma.tenderAttachment.findFirst({
          where: { tenderId, documentType: 'WEBFORM' }
        });

        if (!existingWebform) {
          await this.prisma.tenderAttachment.create({
            data: {
              tenderId,
              fileName: 'webform.json',
              originalUrl: '',
              documentType: 'WEBFORM',
              storagePath: webformPath,
              fileSize: fs.statSync(webformPath).size,
            }
          });
        }
      } catch (err) {
        this.logger.error(`Failed to save webform JSON for tender ${tenderId}: ${err}`);
      }
    }

    // 2. Save physical file metadata and enqueue for background download
    if (item.attachments && item.attachments.length > 0) {
      for (const att of item.attachments) {
        const fileId = att.fileId;
        // Ignore missing or bogus file IDs (like "id" literally which sometimes comes from the source)
        if (!fileId || fileId.length < 10) continue;

        const originalUrl = `https://muasamcong.mpi.gov.vn/api/unau/edocproxy/file/share/${fileId}`;
        const existingAtt = await this.prisma.tenderAttachment.findFirst({
          where: { tenderId, originalUrl }
        });

        if (!existingAtt) {
          const attachment = await this.prisma.tenderAttachment.create({
            data: {
              tenderId,
              fileName: att.fileName || 'unknown_file',
              originalUrl,
              documentType: 'PHYSICAL_FILE',
              storagePath: null, // will be updated after download
            }
          });

          // Enqueue download task
          await this.fileDownloadQueue.enqueueFileDownload({
            attachmentId: attachment.id,
            tenderId,
            originalUrl,
            fileName: attachment.fileName,
          });
        }
      }
    }
  }
}
