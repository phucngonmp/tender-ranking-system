import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { RoleName } from '@prisma/client';
import { CrawlJobsService } from './crawl-jobs.service';
import { QueryCrawlJobsDto } from './dto/query-crawl-jobs.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@Controller('crawl-jobs')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(RoleName.admin)
export class CrawlJobsController {
  constructor(private crawlJobsService: CrawlJobsService) {}

  @Get()
  findAll(@Query() query: QueryCrawlJobsDto) {
    return this.crawlJobsService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.crawlJobsService.findOneOrThrow(id);
  }
}
