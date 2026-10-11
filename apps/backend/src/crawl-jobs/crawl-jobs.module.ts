import { Module } from '@nestjs/common';
import { CrawlJobsService } from './crawl-jobs.service';
import { CrawlJobsController } from './crawl-jobs.controller';

@Module({
  providers: [CrawlJobsService],
  controllers: [CrawlJobsController],
  exports: [CrawlJobsService],
})
export class CrawlJobsModule {}
