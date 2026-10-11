import { Module } from '@nestjs/common';
import { NotificationConfigsController } from './notification-configs.controller';
import { NotificationConfigsService } from './notification-configs.service';

@Module({
  controllers: [NotificationConfigsController],
  providers: [NotificationConfigsService],
  exports: [NotificationConfigsService],
})
export class NotificationConfigsModule {}
