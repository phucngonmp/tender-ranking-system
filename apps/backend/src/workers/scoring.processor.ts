import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { ScoringJobData } from '../queue/queue.constants';
import { SCORING_QUEUE } from '../queue/queue.constants';
import { ScoringService } from '../scoring/scoring.service';

@Processor(SCORING_QUEUE, { concurrency: 5 })
export class ScoringProcessor extends WorkerHost {
  private readonly logger = new Logger(ScoringProcessor.name);

  constructor(private scoringService: ScoringService) {
    super();
  }

  async process(job: Job<ScoringJobData>): Promise<void> {
    try {
      await this.scoringService.scoreTender(job.data.tenderId);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown scoring error';
      this.logger.error(`Scoring failed for tender ${job.data.tenderId}: ${message}`);
      throw err;
    }
  }
}
