import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { HealthModule } from './health/health.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { SourcesModule } from './sources/sources.module';
import { CriteriaProfilesModule } from './criteria-profiles/criteria-profiles.module';
import { TendersModule } from './tenders/tenders.module';
import { CrawlJobsModule } from './crawl-jobs/crawl-jobs.module';
import { ScoringModule } from './scoring/scoring.module';
import { InternalModule } from './internal/internal.module';
import { SchedulerModule } from './scheduler/scheduler.module';
import { WorkersModule } from './workers/workers.module';
import { ScoringCriteriaModule } from './scoring-criteria/scoring-criteria.module';
import { EmailDigestModule } from './email-digest/email-digest.module';
import { ClosedTendersModule } from './closed-tenders/closed-tenders.module';
import { NotificationConfigsModule } from './notification-configs/notification-configs.module';
import { MailModule } from './mail/mail.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    HealthModule,
    AuthModule,
    UsersModule,
    SourcesModule,
    CriteriaProfilesModule,
    TendersModule,
    CrawlJobsModule,
    ScoringModule,
    InternalModule,
    SchedulerModule,
    WorkersModule,
    ScoringCriteriaModule,
    EmailDigestModule,
    ClosedTendersModule,
    NotificationConfigsModule,
    MailModule,
  ],
})
export class AppModule {}
