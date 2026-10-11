import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { CRAWL_QUEUE, CrawlJobData } from './queue.constants';

@Injectable()
export class CrawlQueueService {
  constructor(@InjectQueue(CRAWL_QUEUE) private queue: Queue<CrawlJobData>) {}

  async enqueue(data: CrawlJobData) {
    await this.queue.add('dispatch-crawl', data, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
      removeOnComplete: true,
      removeOnFail: 100,
    });
  }
}
