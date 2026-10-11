import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { RoleName } from '@prisma/client';
import { ClosedTenderKeywordsService } from './closed-tender-keywords.service';
import { CreateClosedTenderKeywordDto } from './dto/create-closed-tender-keyword.dto';
import { UpdateClosedTenderKeywordDto } from './dto/update-closed-tender-keyword.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/types/authenticated-user';

@Controller('closed-tender-keywords')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ClosedTenderKeywordsController {
  constructor(private keywordsService: ClosedTenderKeywordsService) {}

  @Get()
  findAll() {
    // Accessible to any authenticated user — the "Danh sách KQĐT" app page
    // needs this to populate its keyword filter.
    return this.keywordsService.findAll();
  }

  @Get('crawl-jobs')
  @Roles(RoleName.admin)
  findCrawlJobs(@Query('keyword_id') keywordId?: string) {
    return this.keywordsService.findCrawlJobs(keywordId);
  }

  @Post()
  @Roles(RoleName.admin)
  create(@Body() dto: CreateClosedTenderKeywordDto, @CurrentUser() user: AuthenticatedUser) {
    return this.keywordsService.create(dto, user.userId);
  }

  @Patch(':id')
  @Roles(RoleName.admin)
  update(@Param('id') id: string, @Body() dto: UpdateClosedTenderKeywordDto) {
    return this.keywordsService.update(id, dto);
  }

  @Delete(':id')
  @Roles(RoleName.admin)
  remove(@Param('id') id: string) {
    return this.keywordsService.remove(id);
  }

  @Post(':id/crawl-now')
  @Roles(RoleName.admin)
  crawlNow(@Param('id') id: string) {
    return this.keywordsService.crawlNow(id);
  }

  @Post('crawl-by-source/:sourceId')
  @Roles(RoleName.admin)
  crawlBySource(@Param('sourceId') sourceId: string) {
    return this.keywordsService.crawlBySource(sourceId);
  }
}
