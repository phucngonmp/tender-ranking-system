import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Job } from 'bullmq';
import axios from 'axios';
import { CrawlJobStatus } from '@prisma/client';
import { CLOSED_TENDER_QUEUE, ClosedTenderJobData } from '../queue/queue.constants';
import { PrismaService } from '../prisma/prisma.service';

@Processor(CLOSED_TENDER_QUEUE, { concurrency: 2 })
export class ClosedTenderCrawlProcessor extends WorkerHost {
  private readonly logger = new Logger(ClosedTenderCrawlProcessor.name);

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {
    super();
  }

  async process(job: Job<ClosedTenderJobData>): Promise<void> {
    const { crawlJobId, keywordId, keyword } = job.data;
    const workerUrl = this.configService.get<string>('CRAWLER_WORKER_URL');
    const backendUrl = this.configService.get<string>('BACKEND_INTERNAL_URL');
    const internalToken = this.configService.get<string>('INTERNAL_API_TOKEN');
    const callbackUrl = `${backendUrl}/internal/closed-tender-callback`;

    try {
      await this.prisma.closedTenderCrawlJob.update({
        where: { id: crawlJobId },
        data: { status: CrawlJobStatus.running, startedAt: new Date() },
      });

      await axios.post(
        `${workerUrl}/muasamcong/closed-search`,
        {
          keyword_id: keywordId,
          crawl_job_id: crawlJobId,
          keyword,
          callback_url: callbackUrl,
        },
        {
          headers: { 'x-internal-token': internalToken },
          timeout: 15_000,
        },
      );
      // Worker accepted the job and will POST results back to
      // /internal/closed-tender-callback asynchronously; final status is set there.
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to dispatch closed-tender crawl job';
      this.logger.error(`Closed-tender crawl dispatch failed for keyword ${keyword}: ${message}`);
      await this.prisma.closedTenderCrawlJob.update({
        where: { id: crawlJobId },
        data: {
          status: CrawlJobStatus.failed,
          errorMessage: message,
          finishedAt: new Date(),
        },
      });
    }
  }
}
