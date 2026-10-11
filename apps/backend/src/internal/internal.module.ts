import { Module } from '@nestjs/common';
import { InternalService } from './internal.service';
import { InternalController } from './internal.controller';
import { QueueModule } from '../queue/queue.module';

@Module({
  imports: [QueueModule],
  providers: [InternalService],
  controllers: [InternalController],
})
export class InternalModule {}
