import { Module } from '@nestjs/common';
import { ScoringService } from './scoring.service';
import { OpenAiScoringService } from './openai-scoring.service';
import { QueueModule } from '../queue/queue.module';
import { ScoringCriteriaModule } from '../scoring-criteria/scoring-criteria.module';
import { ScoringHistoriesController } from './scoring-histories.controller';
import { ScoringHistoriesService } from './scoring-histories.service';
import { ScoringGateway } from './scoring.gateway';

@Module({
  imports: [QueueModule, ScoringCriteriaModule],
  controllers: [ScoringHistoriesController],
  providers: [ScoringService, OpenAiScoringService, ScoringHistoriesService, ScoringGateway],
  exports: [ScoringService, OpenAiScoringService, ScoringGateway],
})
export class ScoringModule {}
