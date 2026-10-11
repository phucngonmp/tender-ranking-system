import { Module } from '@nestjs/common';
import { MailService } from './mail.service';
import { PrismaModule } from '../prisma/prisma.module';
import { MailerModule } from '@nestjs-modules/mailer';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
  imports: [
    MailerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => ({
        transport: {
          host: configService.get<string>('SMTP_HOST'),
          port: configService.get<number>('SMTP_PORT'),
          secure: configService.get<string>('SMTP_SECURE') === 'true',
          auth: {
            user: configService.get<string>('SMTP_USER'),
            pass: configService.get<string>('SMTP_PASSWORD'),
          },
        },
        defaults: {
          from: `"${configService.get<string>('SMTP_FROM_NAME', 'Tender Ranking System')}" <${configService.get<string>('SMTP_FROM_EMAIL')}>`,
        },
      }),
    }),
    PrismaModule,
  ],
  providers: [MailService],
  exports: [MailService],
})
export class MailModule {}
