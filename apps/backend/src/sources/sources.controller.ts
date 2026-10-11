import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { RoleName } from '@prisma/client';
import { SourcesService } from './sources.service';
import { CreateSourceDto } from './dto/create-source.dto';
import { UpdateSourceDto } from './dto/update-source.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/types/authenticated-user';

@Controller('sources')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SourcesController {
  constructor(private sourcesService: SourcesService) {}

  @Get()
  findAll() {
    // Accessible to any authenticated user (not just admin) — members need this
    // to populate the "Nguồn dữ liệu" filter on the tenders ranking page.
    return this.sourcesService.findAll();
  }

  @Post()
  @Roles(RoleName.admin)
  create(@Body() dto: CreateSourceDto, @CurrentUser() user: AuthenticatedUser) {
    return this.sourcesService.create(dto, user.userId);
  }

  @Patch(':id')
  @Roles(RoleName.admin)
  update(@Param('id') id: string, @Body() dto: UpdateSourceDto) {
    return this.sourcesService.update(id, dto);
  }

  @Delete(':id')
  @Roles(RoleName.admin)
  remove(@Param('id') id: string) {
    return this.sourcesService.remove(id);
  }

  @Post(':id/crawl-now')
  @Roles(RoleName.admin)
  crawlNow(@Param('id') id: string) {
    return this.sourcesService.crawlNow(id);
  }
}
