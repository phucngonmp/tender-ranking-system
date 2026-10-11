import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { CLOSED_TENDER_QUEUE, ClosedTenderJobData } from './queue.constants';

@Injectable()
export class ClosedTenderQueueService {
  constructor(@InjectQueue(CLOSED_TENDER_QUEUE) private queue: Queue<ClosedTenderJobData>) {}

  async enqueue(data: ClosedTenderJobData) {
    await this.queue.add('dispatch-closed-tender-crawl', data, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
      removeOnComplete: true,
      removeOnFail: 100,
    });
  }
}
