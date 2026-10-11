import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ClosedTenderStatsService } from './closed-tender-stats.service';
import { CompetitorAssessmentService } from './competitor-assessment.service';
import { QueryClosedTenderCompaniesDto } from './dto/query-closed-tender-companies.dto';
import { QueryClosedTenderStatsFiltersDto } from './dto/query-closed-tender-stats-filters.dto';
import { RunCompetitorAssessmentDto } from './dto/run-competitor-assessment.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/types/authenticated-user';

@Controller('closed-tender-stats')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ClosedTenderStatsController {
  constructor(
    private statsService: ClosedTenderStatsService,
    private competitorAssessmentService: CompetitorAssessmentService,
  ) {}

  @Get('data-freshness')
  getDataFreshness() {
    return this.statsService.getDataFreshness();
  }

  @Get('summary')
  getSummary(@Query() filters: QueryClosedTenderStatsFiltersDto) {
    return this.statsService.getSummary(filters);
  }

  @Get('by-keyword')
  getByKeyword() {
    return this.statsService.getByKeyword();
  }

  @Get('top-winners')
  getTopWinners(@Query() filters: QueryClosedTenderStatsFiltersDto) {
    return this.statsService.getTopWinners(filters.limit ?? 10, filters);
  }

  @Get('companies')
  getCompanies(@Query() query: QueryClosedTenderCompaniesDto) {
    return this.statsService.getCompanies(query);
  }

  @Get('company-tenders')
  getCompanyTenders(@Query('company_key') companyKey: string) {
    return this.statsService.getCompanyTenders(companyKey);
  }

  @Get('company-profile')
  getCompanyProfile(@Query('company_key') companyKey: string) {
    return this.statsService.getCompanyProfile(companyKey);
  }

  @Get('competitor-assessment')
  getCompetitorAssessment(@Query('company_key') companyKey: string) {
    return this.competitorAssessmentService.getCached(companyKey);
  }

  @Post('competitor-assessment')
  runCompetitorAssessment(@Body() dto: RunCompetitorAssessmentDto, @CurrentUser() user: AuthenticatedUser) {
    return this.competitorAssessmentService.runAssessment(dto.company_key, user.email);
  }
}
