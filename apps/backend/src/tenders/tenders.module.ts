import { Module } from '@nestjs/common';
import { TendersService } from './tenders.service';
import { TendersController } from './tenders.controller';
import { QueueModule } from '../queue/queue.module';
import { ScoringModule } from '../scoring/scoring.module';

@Module({
  imports: [QueueModule, ScoringModule],
  providers: [TendersService],
  controllers: [TendersController],
})
export class TendersModule {}
