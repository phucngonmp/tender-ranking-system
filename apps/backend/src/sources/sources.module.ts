import { Module } from '@nestjs/common';
import { SourcesService } from './sources.service';
import { SourcesController } from './sources.controller';
import { QueueModule } from '../queue/queue.module';

@Module({
  imports: [QueueModule],
  providers: [SourcesService],
  controllers: [SourcesController],
  exports: [SourcesService],
})
export class SourcesModule {}
