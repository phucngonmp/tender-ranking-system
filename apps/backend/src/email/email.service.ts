import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

/**
 * Thin wrapper around nodemailer using generic SMTP (works with Gmail
 * Workspace, Office365, or any company mail server) — configured entirely
 * via env vars, never hardcoded credentials. If SMTP isn't configured, sends
 * are logged and skipped instead of throwing, so the rest of the app keeps
 * working.
 */
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter | null = null;
  private fromAddress = '';

  constructor(private configService: ConfigService) {
    const host = this.configService.get<string>('SMTP_HOST');
    const user = this.configService.get<string>('SMTP_USER');
    const pass = this.configService.get<string>('SMTP_PASSWORD');

    if (!host || !user || !pass) {
      this.logger.warn(
        'SMTP chưa được cấu hình đầy đủ (cần SMTP_HOST/SMTP_USER/SMTP_PASSWORD) — email sẽ không được gửi.',
      );
      return;
    }

    const port = Number(this.configService.get<string>('SMTP_PORT') ?? 587);
    const fromEmail = this.configService.get<string>('SMTP_FROM_EMAIL') ?? user;
    const fromName = this.configService.get<string>('SMTP_FROM_NAME') ?? 'Tender Ranking System';
    this.fromAddress = `"${fromName}" <${fromEmail}>`;

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure: this.configService.get<string>('SMTP_SECURE') === 'true',
      auth: { user, pass },
    });
  }

  get isConfigured(): boolean {
    return this.transporter !== null;
  }

  async sendMail(to: string[], subject: string, html: string): Promise<boolean> {
    if (!this.transporter) {
      this.logger.warn(`Bỏ qua gửi mail "${subject}" — SMTP chưa cấu hình.`);
      return false;
    }
    if (to.length === 0) {
      this.logger.warn(`Bỏ qua gửi mail "${subject}" — chưa có người nhận.`);
      return false;
    }

    await this.transporter.sendMail({ from: this.fromAddress, to: to.join(', '), subject, html });
    this.logger.log(`Đã gửi mail "${subject}" tới ${to.join(', ')}`);
    return true;
  }
}
