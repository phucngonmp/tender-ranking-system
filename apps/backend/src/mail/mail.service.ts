import { Injectable, Logger } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(
    private readonly mailerService: MailerService,
    private readonly prisma: PrismaService,
  ) {}

  async sendMail(
    to: string, 
    subject: string, 
    content: string, 
    tenderId?: string,
    htmlContent?: string,
    attachments?: Array<{ filename: string; path?: string; content?: any; contentType?: string }>
  ) {
    this.logger.log(`[REAL EMAIL] Sending email to: ${to}`);
    this.logger.log(`[REAL EMAIL] Subject: ${subject}`);
    
    try {
      await this.mailerService.sendMail({
        to,
        subject,
        text: content,
        html: htmlContent || `<p>${content.replace(/\n/g, '<br>')}</p>`, // basic formatting if no html provided
        attachments: attachments || [],
      });
      this.logger.log(`Email successfully sent to ${to}`);
      
      if (tenderId) {
        await this.prisma.tenderEmailHistory.create({
          data: {
            tenderId,
            recipient: to,
            subject,
            status: 'success',
          },
        });
      }

      return { success: true };
    } catch (error) {
      this.logger.error(`Failed to send email to ${to}: ${error.message}`, error.stack);
      
      if (tenderId) {
        await this.prisma.tenderEmailHistory.create({
          data: {
            tenderId,
            recipient: to,
            subject,
            status: 'failed',
            errorMsg: error.message,
          },
        });
      }

      return { success: false, error: error.message };
    }
  }
}
