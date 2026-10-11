import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Job } from 'bullmq';
import axios from 'axios';
import { CrawlJobStatus } from '@prisma/client';
import { CRAWL_QUEUE, CrawlJobData, KEYWORD_SOURCE_ENDPOINTS } from '../queue/queue.constants';
import { PrismaService } from '../prisma/prisma.service';

@Processor(CRAWL_QUEUE, { concurrency: 3 })
export class CrawlProcessor extends WorkerHost {
  private readonly logger = new Logger(CrawlProcessor.name);

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {
    super();
  }

  async process(job: Job<CrawlJobData>): Promise<void> {
    const { crawlJobId, sourceId } = job.data;
    const workerUrl = this.configService.get<string>('CRAWLER_WORKER_URL');
    const backendUrl = this.configService.get<string>('BACKEND_INTERNAL_URL');
    const internalToken = this.configService.get<string>('INTERNAL_API_TOKEN');
    const callbackUrl = `${backendUrl}/internal/crawl-callback`;

    try {
      await this.prisma.crawlJob.update({
        where: { id: crawlJobId },
        data: { status: CrawlJobStatus.running, startedAt: new Date() },
      });

      const endpoint =
        job.data.mode === 'url' ? '/crawl' : KEYWORD_SOURCE_ENDPOINTS[job.data.mode];
      const payload =
        job.data.mode === 'url'
          ? {
              source_id: sourceId,
              crawl_job_id: crawlJobId,
              url: job.data.url,
              callback_url: callbackUrl,
            }
          : {
              source_id: sourceId,
              crawl_job_id: crawlJobId,
              keyword: job.data.keyword,
              callback_url: callbackUrl,
            };

      await axios.post(`${workerUrl}${endpoint}`, payload, {
        headers: { 'x-internal-token': internalToken },
        timeout: 15_000,
      });
      // Worker accepted the job and will POST results back to /internal/crawl-callback
      // asynchronously; final status (success/failed) is set there.
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to dispatch crawl job';
      this.logger.error(`Crawl dispatch failed for source ${sourceId}: ${message}`);
      await this.prisma.crawlJob.update({
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
