import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { RoleName } from '@prisma/client';
import { ScoringHistoriesService } from './scoring-histories.service';
import { QueryScoringHistoriesDto } from './dto/query-scoring-histories.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@Controller('scoring-histories')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(RoleName.admin)
export class ScoringHistoriesController {
  constructor(private scoringHistoriesService: ScoringHistoriesService) {}

  @Get()
  findAll(@Query() query: QueryScoringHistoriesDto) {
    return this.scoringHistoriesService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.scoringHistoriesService.findOneOrThrow(id);
  }
}
