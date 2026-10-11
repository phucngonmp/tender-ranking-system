import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { CRAWL_QUEUE, SCORING_QUEUE, FILE_DOWNLOAD_QUEUE, CLOSED_TENDER_QUEUE } from './queue.constants';
import { CrawlQueueService } from './crawl-queue.service';
import { ScoringQueueService } from './scoring-queue.service';
import { FileDownloadQueueService } from './file-download-queue.service';
import { ClosedTenderQueueService } from './closed-tender-queue.service';

@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          url: config.get<string>('REDIS_URL'),
        },
      }),
    }),
    BullModule.registerQueue(
      { name: CRAWL_QUEUE },
      { name: SCORING_QUEUE },
      { name: FILE_DOWNLOAD_QUEUE },
      { name: CLOSED_TENDER_QUEUE },
    ),
  ],
  providers: [CrawlQueueService, ScoringQueueService, FileDownloadQueueService, ClosedTenderQueueService],
  exports: [
    BullModule,
    CrawlQueueService,
    ScoringQueueService,
    FileDownloadQueueService,
    ClosedTenderQueueService,
  ],
})
export class QueueModule {}
