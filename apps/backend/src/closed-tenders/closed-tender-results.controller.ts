import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ClosedTenderResultsService } from './closed-tender-results.service';
import { QueryClosedTenderResultsDto } from './dto/query-closed-tender-results.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';

@Controller('closed-tender-results')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ClosedTenderResultsController {
  constructor(private resultsService: ClosedTenderResultsService) {}

  @Get()
  findAll(@Query() query: QueryClosedTenderResultsDto) {
    return this.resultsService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.resultsService.findOneOrThrow(id);
  }
}
