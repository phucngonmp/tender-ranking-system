import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { CrawlJobStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ClosedTenderQueueService } from '../queue/closed-tender-queue.service';

const MAX_CONCURRENT_CLOSED_TENDER_CRAWLS = 2;

function isSameCalendarDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
  );
}

/** Daily cron dispatch for closed-tender keywords, mirroring SchedulerService's
 * per-source crawlHour dispatch — kept separate so this crawl type never touches
 * the Source/Tender scheduling path. */
@Injectable()
export class ClosedTenderSchedulerService {
  private readonly logger = new Logger(ClosedTenderSchedulerService.name);

  constructor(
    private prisma: PrismaService,
    private closedTenderQueue: ClosedTenderQueueService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async dispatchDueClosedTenderCrawls(): Promise<void> {
    const inFlightCount = await this.prisma.closedTenderCrawlJob.count({
      where: { status: { in: [CrawlJobStatus.pending, CrawlJobStatus.running] } },
    });
    const availableSlots = MAX_CONCURRENT_CLOSED_TENDER_CRAWLS - inFlightCount;
    if (availableSlots <= 0) return;

    const activeKeywords = await this.prisma.closedTenderKeyword.findMany({
      where: { isActive: true },
    });

    const now = new Date();
    const dueKeywords = activeKeywords
      .filter((kw) => {
        if (now.getHours() < kw.crawlHour) return false;
        if (!kw.lastCrawledAt) return true;
        return !isSameCalendarDay(kw.lastCrawledAt, now);
      })
      .slice(0, availableSlots);

    for (const kw of dueKeywords) {
      const crawlJob = await this.prisma.closedTenderCrawlJob.create({
        data: { keywordId: kw.id, status: CrawlJobStatus.pending },
      });

      await this.closedTenderQueue.enqueue({
        crawlJobId: crawlJob.id,
        keywordId: kw.id,
        keyword: kw.keyword,
      });
      this.logger.log(`Scheduled closed-tender crawl for keyword "${kw.keyword}" (${kw.id})`);
    }
  }
}
