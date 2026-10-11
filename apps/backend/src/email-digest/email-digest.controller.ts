import { Body, Controller, Get, Patch, Post, UseGuards } from '@nestjs/common';
import { RoleName } from '@prisma/client';
import { EmailDigestSettingsService } from './email-digest-settings.service';
import { EmailDigestService } from './email-digest.service';
import { UpdateEmailDigestSettingDto } from './dto/update-email-digest-setting.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@Controller('email-digest')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(RoleName.admin)
export class EmailDigestController {
  constructor(
    private settingsService: EmailDigestSettingsService,
    private digestService: EmailDigestService,
  ) {}

  @Get('settings')
  getSettings() {
    return this.settingsService.get();
  }

  @Patch('settings')
  updateSettings(@Body() dto: UpdateEmailDigestSettingDto) {
    return this.settingsService.update(dto);
  }

  @Post('send-now')
  sendNow() {
    return this.digestService.sendNow();
  }
}
