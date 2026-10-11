import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateEmailDigestSettingDto } from './dto/update-email-digest-setting.dto';

const SETTINGS_ID = 1;

@Injectable()
export class EmailDigestSettingsService {
  constructor(private prisma: PrismaService) {}

  private getOrCreate() {
    return this.prisma.emailDigestSetting.upsert({
      where: { id: SETTINGS_ID },
      update: {},
      create: { id: SETTINGS_ID },
    });
  }

  get() {
    return this.getOrCreate();
  }

  async update(dto: UpdateEmailDigestSettingDto) {
    await this.getOrCreate();
    return this.prisma.emailDigestSetting.update({ where: { id: SETTINGS_ID }, data: dto });
  }

  markSent() {
    return this.prisma.emailDigestSetting.update({
      where: { id: SETTINGS_ID },
      data: { lastSentAt: new Date() },
    });
  }
}
