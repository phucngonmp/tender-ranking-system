import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { RoleName } from '@prisma/client';
import { ScoringCriteriaService } from './scoring-criteria.service';
import { CreateScoringCriteriaGroupDto } from './dto/create-group.dto';
import { UpdateScoringCriteriaGroupDto } from './dto/update-group.dto';
import { CreateScoringCriteriaTierDto } from './dto/create-tier.dto';
import { UpdateScoringCriteriaTierDto } from './dto/update-tier.dto';
import { MoveDto } from './dto/move.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@Controller('scoring-criteria')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(RoleName.admin)
export class ScoringCriteriaController {
  constructor(private service: ScoringCriteriaService) {}

  @Get('fields')
  fieldMetadata() {
    return this.service.fieldMetadata();
  }

  @Get('groups')
  findAllGroups() {
    return this.service.findAllGroups();
  }

  @Post('groups')
  createGroup(@Body() dto: CreateScoringCriteriaGroupDto) {
    return this.service.createGroup(dto);
  }

  @Patch('groups/:id')
  updateGroup(@Param('id') id: string, @Body() dto: UpdateScoringCriteriaGroupDto) {
    return this.service.updateGroup(id, dto);
  }

  @Delete('groups/:id')
  deleteGroup(@Param('id') id: string) {
    return this.service.deleteGroup(id);
  }

  @Post('groups/:id/move')
  moveGroup(@Param('id') id: string, @Body() dto: MoveDto) {
    return this.service.moveGroup(id, dto.direction);
  }

  @Post('groups/:groupId/tiers')
  createTier(@Param('groupId') groupId: string, @Body() dto: CreateScoringCriteriaTierDto) {
    return this.service.createTier(groupId, dto);
  }

  @Patch('tiers/:id')
  updateTier(@Param('id') id: string, @Body() dto: UpdateScoringCriteriaTierDto) {
    return this.service.updateTier(id, dto);
  }

  @Delete('tiers/:id')
  deleteTier(@Param('id') id: string) {
    return this.service.deleteTier(id);
  }

  @Post('tiers/:id/move')
  moveTier(@Param('id') id: string, @Body() dto: MoveDto) {
    return this.service.moveTier(id, dto.direction);
  }
}
