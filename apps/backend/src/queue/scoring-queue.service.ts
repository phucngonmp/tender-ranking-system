import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { SCORING_QUEUE, ScoringJobData } from './queue.constants';

@Injectable()
export class ScoringQueueService {
  constructor(@InjectQueue(SCORING_QUEUE) private queue: Queue<ScoringJobData>) {}

  async enqueue(data: ScoringJobData) {
    await this.queue.add('score-tender', data, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 3000 },
      removeOnComplete: true,
      removeOnFail: 100,
    });
  }
}
