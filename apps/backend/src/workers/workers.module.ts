import { Module } from '@nestjs/common';
import { QueueModule } from '../queue/queue.module';
import { ScoringModule } from '../scoring/scoring.module';
import { CrawlProcessor } from './crawl.processor';
import { ScoringProcessor } from './scoring.processor';
import { FileDownloadProcessor } from './file-download.processor';

@Module({
  imports: [QueueModule, ScoringModule],
  providers: [CrawlProcessor, ScoringProcessor, FileDownloadProcessor],
})
export class WorkersModule {}
