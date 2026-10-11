import { Module } from '@nestjs/common';
import { EmailDigestSettingsService } from './email-digest-settings.service';
import { EmailDigestService } from './email-digest.service';
import { EmailDigestController } from './email-digest.controller';
import { EmailModule } from '../email/email.module';

@Module({
  imports: [EmailModule],
  providers: [EmailDigestSettingsService, EmailDigestService],
  controllers: [EmailDigestController],
})
export class EmailDigestModule {}
