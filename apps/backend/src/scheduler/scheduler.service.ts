import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { CrawlJobStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CrawlQueueService } from '../queue/crawl-queue.service';
import { buildCrawlJobData } from '../queue/build-crawl-job-data';

const DEFAULT_MAX_CONCURRENT_CRAWLS = 5;

function isSameCalendarDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
  );
}

@Injectable()
export class SchedulerService {
  private readonly logger = new Logger(SchedulerService.name);

  constructor(
    private prisma: PrismaService,
    private crawlQueue: CrawlQueueService,
    private configService: ConfigService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async dispatchDueCrawls(): Promise<void> {
    const maxConcurrent =
      this.configService.get<number>('MAX_CONCURRENT_CRAWLS') ?? DEFAULT_MAX_CONCURRENT_CRAWLS;

    const inFlightJobs = await this.prisma.crawlJob.findMany({
      where: { status: { in: [CrawlJobStatus.pending, CrawlJobStatus.running] } },
      select: { sourceId: true },
    });
    const availableSlots = maxConcurrent - inFlightJobs.length;
    if (availableSlots <= 0) {
      return;
    }

    const inFlightSourceIds = new Set(inFlightJobs.map((j) => j.sourceId));

    const activeSources = await this.prisma.source.findMany({
      where: { isActive: true },
    });

    const now = new Date();
    const dueSources = activeSources
      .filter((source) => {
        if (inFlightSourceIds.has(source.id)) return false;
        if (now.getHours() < source.crawlHour) return false;
        if (!source.lastCrawledAt) return true;
        return !isSameCalendarDay(source.lastCrawledAt, now);
      })
      .slice(0, availableSlots);

    for (const source of dueSources) {
      const crawlJob = await this.prisma.crawlJob.create({
        data: { sourceId: source.id, status: CrawlJobStatus.pending },
      });

      await this.crawlQueue.enqueue(buildCrawlJobData(source, crawlJob.id));
      this.logger.log(`Scheduled crawl for source ${source.name} (${source.id})`);
    }
  }
}
