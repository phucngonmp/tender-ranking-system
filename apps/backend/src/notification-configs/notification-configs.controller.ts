import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { RoleName } from '@prisma/client';
import { NotificationConfigsService } from './notification-configs.service';
import { UpdateNotificationConfigDto } from './dto/update-notification-config.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@Controller('notification-configs')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(RoleName.admin)
export class NotificationConfigsController {
  constructor(private service: NotificationConfigsService) {}

  @Get()
  getConfig() {
    return this.service.getConfig();
  }

  @Put()
  updateConfig(@Body() dto: UpdateNotificationConfigDto) {
    return this.service.updateConfig(dto);
  }

  @Get('recipients/stats')
  getRecipientStats() {
    return this.service.getRecipientStats();
  }
}
