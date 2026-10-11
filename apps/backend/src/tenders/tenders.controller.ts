import { Controller, Get, Param, Post, Query, UseGuards, Res } from '@nestjs/common';
import { RoleName } from '@prisma/client';
import { TendersService } from './tenders.service';
import { QueryTendersDto } from './dto/query-tenders.dto';
import { QueryEmailHistoriesDto, QueryEmailHistoriesByRecipientDto } from './dto/query-email-histories.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@Controller('tenders')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TendersController {
  constructor(private tendersService: TendersService) {}

  @Get()
  findAll(@Query() query: QueryTendersDto) {
    return this.tendersService.findAll(query);
  }

  // Literal sub-paths registered before ":id" so they aren't shadowed by it.
  @Get('data-freshness')
  getDataFreshness() {
    return this.tendersService.getDataFreshness();
  }

  @Get('email-histories/all')
  findAllEmailHistories(@Query() query: QueryEmailHistoriesDto) {
    return this.tendersService.findAllTendersWithEmailHistories(query.page ?? 1, query.limit ?? 10);
  }

  @Get('email-histories/by-recipient')
  findEmailHistoriesByRecipient(@Query() query: QueryEmailHistoriesByRecipientDto) {
    return this.tendersService.findEmailHistoriesByRecipient(query.email, query.page ?? 1, query.limit ?? 10);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.tendersService.findOneOrThrow(id);
  }

  @Get(':id/email-histories')
  findEmailHistories(@Param('id') id: string, @Query() query: QueryEmailHistoriesDto) {
    return this.tendersService.findEmailHistories(id, query.page ?? 1, query.limit ?? 10);
  }

  @Post(':id/rescore')
  @Roles(RoleName.admin)
  rescore(@Param('id') id: string) {
    return this.tendersService.rescore(id);
  }

  @Post(':id/rescore-rubric')
  @Roles(RoleName.admin)
  rescoreRubric(@Param('id') id: string) {
    return this.tendersService.rescoreRubric(id);
  }

  @Get(':id/attachments/:attachmentId/download')
  async downloadAttachment(
    @Param('id') tenderId: string,
    @Param('attachmentId') attachmentId: string,
    @Query('inline') inline: string,
    @Res() res: any,
  ) {
    const { storagePath, filename } = await this.tendersService.downloadAttachment(tenderId, attachmentId);
    
    let contentType = 'application/octet-stream';
    const ext = filename.split('.').pop()?.toLowerCase();
    if (ext === 'pdf') contentType = 'application/pdf';
    else if (ext === 'docx') contentType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    else if (ext === 'doc') contentType = 'application/msword';
    else if (ext === 'png') contentType = 'image/png';
    else if (ext === 'jpg' || ext === 'jpeg') contentType = 'image/jpeg';
    else if (ext === 'json') contentType = 'application/json';

    const disposition = inline === 'true' ? 'inline' : 'attachment';

    res.set({
      'Content-Type': contentType,
      'Content-Disposition': `${disposition}; filename="${encodeURIComponent(filename)}"`,
    });
    
    // Express sendFile handles streaming properly
    res.sendFile(storagePath, { root: '/' }, (err: any) => {
      if (err) {
        if (!res.headersSent) {
          res.status(500).json({ statusCode: 500, message: 'Could not send file' });
        }
      }
    });
  }
}
