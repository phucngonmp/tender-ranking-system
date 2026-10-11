import { Injectable, NotFoundException } from '@nestjs/common';
import { CrawlJobStatus, SourceType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CrawlQueueService } from '../queue/crawl-queue.service';
import { buildCrawlJobData } from '../queue/build-crawl-job-data';
import { CreateSourceDto } from './dto/create-source.dto';
import { UpdateSourceDto } from './dto/update-source.dto';

@Injectable()
export class SourcesService {
  constructor(
    private prisma: PrismaService,
    private crawlQueue: CrawlQueueService,
  ) {}

  findAll() {
    return this.prisma.source.findMany({ orderBy: { createdAt: 'desc' } });
  }

  async findOneOrThrow(id: string) {
    const source = await this.prisma.source.findUnique({ where: { id } });
    if (!source) {
      throw new NotFoundException('Source not found');
    }
    return source;
  }

  create(dto: CreateSourceDto, createdBy: string) {
    return this.prisma.source.create({
      data: {
        name: dto.name,
        sourceType: dto.sourceType ?? SourceType.url,
        url: dto.url,
        keyword: dto.keyword,
        crawlHour: dto.crawlHour ?? 2,
        minValue: dto.minValue,
        maxValue: dto.maxValue,
        isActive: dto.isActive ?? true,
        autoScore: dto.autoScore ?? true,
        createdBy,
      },
    });
  }

  async update(id: string, dto: UpdateSourceDto) {
    await this.findOneOrThrow(id);
    return this.prisma.source.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.findOneOrThrow(id);
    await this.prisma.source.delete({ where: { id } });
    return { success: true };
  }

  async crawlNow(id: string) {
    const source = await this.findOneOrThrow(id);

    const crawlJob = await this.prisma.crawlJob.create({
      data: {
        sourceId: source.id,
        status: CrawlJobStatus.pending,
      },
    });

    await this.crawlQueue.enqueue(buildCrawlJobData(source, crawlJob.id));

    return { crawlJobId: crawlJob.id };
  }
}
