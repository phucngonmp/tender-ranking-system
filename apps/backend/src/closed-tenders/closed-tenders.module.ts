import { Module } from '@nestjs/common';
import { QueueModule } from '../queue/queue.module';
import { ClosedTenderKeywordsController } from './closed-tender-keywords.controller';
import { ClosedTenderKeywordsService } from './closed-tender-keywords.service';
import { ClosedTenderResultsController } from './closed-tender-results.controller';
import { ClosedTenderResultsService } from './closed-tender-results.service';
import { ClosedTenderCallbackController } from './closed-tender-callback.controller';
import { ClosedTenderCallbackService } from './closed-tender-callback.service';
import { ClosedTenderCrawlProcessor } from './closed-tender-crawl.processor';
import { ClosedTenderSchedulerService } from './closed-tender-scheduler.service';
import { ClosedTenderStatsController } from './closed-tender-stats.controller';
import { ClosedTenderStatsService } from './closed-tender-stats.service';
import { CompetitorAssessmentService } from './competitor-assessment.service';
import { OpenAiCompetitorAssessmentService } from './openai-competitor-assessment.service';

@Module({
  imports: [QueueModule],
  controllers: [
    ClosedTenderKeywordsController,
    ClosedTenderResultsController,
    ClosedTenderCallbackController,
    ClosedTenderStatsController,
  ],
  providers: [
    ClosedTenderKeywordsService,
    ClosedTenderResultsService,
    ClosedTenderCallbackService,
    ClosedTenderCrawlProcessor,
    ClosedTenderSchedulerService,
    ClosedTenderStatsService,
    CompetitorAssessmentService,
    OpenAiCompetitorAssessmentService,
  ],
})
export class ClosedTendersModule {}
