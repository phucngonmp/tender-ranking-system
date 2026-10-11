import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { CrawlJobStatus, SourceType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ClosedTenderQueueService } from '../queue/closed-tender-queue.service';
import { CreateClosedTenderKeywordDto } from './dto/create-closed-tender-keyword.dto';
import { UpdateClosedTenderKeywordDto } from './dto/update-closed-tender-keyword.dto';

@Injectable()
export class ClosedTenderKeywordsService {
  constructor(
    private prisma: PrismaService,
    private closedTenderQueue: ClosedTenderQueueService,
  ) {}

  findAll() {
    return this.prisma.closedTenderKeyword.findMany({
      include: { source: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOneOrThrow(id: string) {
    const keyword = await this.prisma.closedTenderKeyword.findUnique({ where: { id } });
    if (!keyword) {
      throw new NotFoundException('Closed tender keyword not found');
    }
    return keyword;
  }

  private async resolveKeywordFromSource(sourceId: string): Promise<string> {
    const source = await this.prisma.source.findUnique({ where: { id: sourceId } });
    if (!source || source.sourceType !== SourceType.muasamcong_keyword || !source.keyword) {
      throw new BadRequestException(
        'Nguồn không hợp lệ — phải chọn một nguồn crawl loại MuaSamCong (từ khoá) đã có sẵn ở trang Nguồn crawl',
      );
    }
    return source.keyword;
  }

  async create(dto: CreateClosedTenderKeywordDto, createdBy: string) {
    const keyword = await this.resolveKeywordFromSource(dto.sourceId);
    return this.prisma.closedTenderKeyword.create({
      data: {
        sourceId: dto.sourceId,
        keyword,
        crawlHour: dto.crawlHour ?? 3,
        isActive: dto.isActive ?? true,
        createdBy,
      },
    });
  }

  async update(id: string, dto: UpdateClosedTenderKeywordDto) {
    await this.findOneOrThrow(id);
    const keyword = dto.sourceId ? await this.resolveKeywordFromSource(dto.sourceId) : undefined;
    return this.prisma.closedTenderKeyword.update({
      where: { id },
      data: { ...dto, ...(keyword ? { keyword } : {}) },
    });
  }

  async remove(id: string) {
    await this.findOneOrThrow(id);
    await this.prisma.closedTenderKeyword.delete({ where: { id } });
    return { success: true };
  }

  /**
   * Entry point for the "Crawl KQĐT" button on the Sources page — the
   * closed-tender feature is merged into Nguồn crawl, so there's no separate
   * keyword-management UI anymore. Finds (or lazily creates) the
   * ClosedTenderKeyword tracking record for this Source, keeping its
   * `keyword` copy in sync with the Source in case it was edited, then
   * triggers a crawl exactly like crawlNow().
   */
  async crawlBySource(sourceId: string) {
    const currentKeyword = await this.resolveKeywordFromSource(sourceId);

    let closedKeyword = await this.prisma.closedTenderKeyword.findFirst({ where: { sourceId } });
    if (!closedKeyword) {
      closedKeyword = await this.prisma.closedTenderKeyword.create({
        data: { sourceId, keyword: currentKeyword, crawlHour: 3, isActive: true },
      });
    } else if (closedKeyword.keyword !== currentKeyword) {
      closedKeyword = await this.prisma.closedTenderKeyword.update({
        where: { id: closedKeyword.id },
        data: { keyword: currentKeyword },
      });
    }

    return this.crawlNow(closedKeyword.id);
  }

  async crawlNow(id: string) {
    const keyword = await this.findOneOrThrow(id);

    const crawlJob = await this.prisma.closedTenderCrawlJob.create({
      data: { keywordId: keyword.id, status: CrawlJobStatus.pending },
    });

    await this.closedTenderQueue.enqueue({
      crawlJobId: crawlJob.id,
      keywordId: keyword.id,
      keyword: keyword.keyword,
    });

    return { crawlJobId: crawlJob.id };
  }

  findCrawlJobs(keywordId?: string) {
    return this.prisma.closedTenderCrawlJob.findMany({
      where: { keywordId },
      include: { keyword: { select: { id: true, keyword: true } } },
      orderBy: { startedAt: 'desc' },
    });
  }
}
