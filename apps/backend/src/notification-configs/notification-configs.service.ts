import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateNotificationConfigDto } from './dto/update-notification-config.dto';

@Injectable()
export class NotificationConfigsService {
  constructor(private prisma: PrismaService) {}

  async getConfig() {
    let config = await this.prisma.notificationConfig.findUnique({
      where: { id: 1 },
    });

    if (!config) {
      config = await this.prisma.notificationConfig.create({
        data: { id: 1 },
      });
    }

    return config;
  }

  async updateConfig(dto: UpdateNotificationConfigDto) {
    const data: any = {};
    
    if (dto.emailsEnabled !== undefined) data.emailsEnabled = dto.emailsEnabled;
    if (dto.emailRecipients !== undefined) data.emailRecipients = dto.emailRecipients;
    if (dto.webhookEnabled !== undefined) data.webhookEnabled = dto.webhookEnabled;
    if (dto.webhookUrl !== undefined) data.webhookUrl = dto.webhookUrl;
    if (dto.webhookType !== undefined) data.webhookType = dto.webhookType;
    if (dto.minScoreThreshold !== undefined) data.minScoreThreshold = dto.minScoreThreshold;
    if (dto.allowedVerdicts !== undefined) data.allowedVerdicts = dto.allowedVerdicts;
    if (dto.includeAttachments !== undefined) data.includeAttachments = dto.includeAttachments;
    if (dto.includeAiAnalysis !== undefined) data.includeAiAnalysis = dto.includeAiAnalysis;

    // Ensure the config exists first
    await this.getConfig();

    return this.prisma.notificationConfig.update({
      where: { id: 1 },
      data,
    });
  }

  async getRecipientStats() {
    const config = await this.getConfig();
    let recipients = (config.emailRecipients as string[]) || [];

    const users = await this.prisma.user.findMany({
      select: { email: true, receiveEmails: true }
    });
    
    // Add internal users with receiveEmails to recipients list (avoid duplicates)
    users.filter(u => u.receiveEmails).forEach(u => {
      if (!recipients.includes(u.email)) {
        recipients.push(u.email);
      }
    });

    const systemEmails = new Set(users.map(u => u.email));

    // Group by recipient and status
    const groupStats = await this.prisma.tenderEmailHistory.groupBy({
      by: ['recipient', 'status'],
      _count: {
        id: true
      }
    });

    return recipients.map(email => {
      const type = systemEmails.has(email) ? 'internal' : 'external';
      const successCount = groupStats.find(s => s.recipient === email && s.status === 'success')?._count.id || 0;
      const failedCount = groupStats.find(s => s.recipient === email && s.status === 'failed')?._count.id || 0;
      
      return {
        email,
        type,
        successCount,
        failedCount
      };
    });
  }
}
