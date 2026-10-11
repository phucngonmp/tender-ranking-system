import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { RoleName } from '@prisma/client';
import { CriteriaProfilesService } from './criteria-profiles.service';
import { CreateCriteriaProfileDto } from './dto/create-criteria-profile.dto';
import { UpdateCriteriaProfileDto } from './dto/update-criteria-profile.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/types/authenticated-user';

@Controller('criteria-profiles')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(RoleName.admin)
export class CriteriaProfilesController {
  constructor(private criteriaProfilesService: CriteriaProfilesService) {}

  @Get()
  findAll() {
    return this.criteriaProfilesService.findAll();
  }

  @Post()
  create(@Body() dto: CreateCriteriaProfileDto, @CurrentUser() user: AuthenticatedUser) {
    return this.criteriaProfilesService.create(dto, user.userId);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateCriteriaProfileDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.criteriaProfilesService.update(id, dto, user.userId);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.criteriaProfilesService.remove(id);
  }

  @Post(':id/activate')
  activate(@Param('id') id: string) {
    return this.criteriaProfilesService.activate(id);
  }
}
