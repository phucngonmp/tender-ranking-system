import { Injectable, Logger } from '@nestjs/common';
import { CrawlJobStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ClosedTenderCallbackDto, ClosedTenderResultItemDto } from './dto/closed-tender-callback.dto';

/**
 * Persists crawled closed-tender results (info + bidder list + award result).
 * Deliberately separate from InternalService.upsertTender — this data never
 * touches the `tenders` table and never enqueues AI scoring.
 */
@Injectable()
export class ClosedTenderCallbackService {
  private readonly logger = new Logger(ClosedTenderCallbackService.name);

  constructor(private prisma: PrismaService) {}

  async handleCallback(dto: ClosedTenderCallbackDto) {
    const now = new Date();

    if (dto.status === 'failed') {
      await this.prisma.closedTenderCrawlJob.update({
        where: { id: dto.crawl_job_id },
        data: {
          status: CrawlJobStatus.failed,
          errorMessage: dto.error_message ?? 'Unknown crawler error',
          finishedAt: now,
        },
      });
      await this.prisma.closedTenderKeyword.update({
        where: { id: dto.keyword_id },
        data: { lastCrawledAt: now },
      });
      return { accepted: true };
    }

    const results = dto.results ?? [];
    let newCount = 0;
    let updatedCount = 0;

    for (const item of results) {
      const wasNew = await this.upsertResult(dto.keyword_id, item);
      if (wasNew) newCount += 1;
      else updatedCount += 1;
    }

    await this.prisma.closedTenderCrawlJob.update({
      where: { id: dto.crawl_job_id },
      data: {
        status: CrawlJobStatus.success,
        itemsFound: results.length,
        finishedAt: now,
      },
    });
    await this.prisma.closedTenderKeyword.update({
      where: { id: dto.keyword_id },
      data: { lastCrawledAt: now },
    });

    this.logger.log(
      `Closed-tender crawl job ${dto.crawl_job_id}: ${results.length} items, ${newCount} new, ${updatedCount} updated`,
    );

    return { accepted: true, newCount, updatedCount };
  }

  /** Identified across crawls by notify_no (mã TBMT) — same tender re-seen on a later
   * crawl (e.g. moved from "Đang xét thầu" to "Có nhà thầu trúng thầu") updates in place. */
  private async upsertResult(keywordId: string, item: ClosedTenderResultItemDto): Promise<boolean> {
    const existing = await this.prisma.closedTenderResult.findUnique({
      where: { notifyNo: item.notify_no },
    });

    const data = {
      keywordId,
      notifyId: item.notify_id,
      inputResultId: item.input_result_id,
      matchedKeyword: item.matched_keyword,
      title: item.title,
      investor: item.investor,
      investorCode: item.investor_code,
      bidField: item.bid_field,
      locality: item.locality,
      estimatedValue: item.estimated_value,
      bidCloseDate: item.bid_close_date ? new Date(item.bid_close_date) : null,
      bidOpenDate: item.bid_open_date ? new Date(item.bid_open_date) : null,
      status: item.status,
      numBidderJoin: item.num_bidder_join,
      decisionNo: item.decision_no,
      decisionDate: item.decision_date ? new Date(item.decision_date) : null,
      decisionAgency: item.decision_agency,
      decisionFileId: item.decision_file_id,
      decisionFileName: item.decision_file_name,
      winningContractorNames: item.winning_contractor_names ?? [],
      winningPrice: item.winning_price,
      sourceUrl: item.source_url,
    };

    let resultId: string;
    if (!existing) {
      const created = await this.prisma.closedTenderResult.create({
        data: { notifyNo: item.notify_no, ...data },
      });
      resultId = created.id;
    } else {
      await this.prisma.closedTenderResult.update({ where: { id: existing.id }, data });
      resultId = existing.id;
    }

    if (item.bidders && item.bidders.length > 0) {
      // Bidder list only grows/settles between crawls (Đang xét thầu -> Có nhà thầu
      // trúng thầu) — simplest correct approach is to replace it wholesale each time.
      await this.prisma.closedTenderBidder.deleteMany({ where: { resultId } });
      await this.prisma.closedTenderBidder.createMany({
        data: item.bidders.map((b) => ({
          resultId,
          orgCode: b.org_code,
          orgFullname: b.org_fullname,
          taxCode: b.tax_code,
          bidPrice: b.bid_price,
          finalPrice: b.final_price,
          isWinner: b.is_winner ?? false,
          winningPrice: b.winning_price,
          rankOrReason: b.rank_or_reason,
          executionTime: b.execution_time,
          contractPeriodText: b.contract_period_text,
        })),
      });
    }

    return !existing;
  }
}
