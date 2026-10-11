import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { QueryCrawlJobsDto } from './dto/query-crawl-jobs.dto';

@Injectable()
export class CrawlJobsService {
  constructor(private prisma: PrismaService) {}

  findAll(query: QueryCrawlJobsDto) {
    return this.prisma.crawlJob.findMany({
      where: {
        sourceId: query.source_id,
        status: query.status,
      },
      include: { source: { select: { id: true, name: true } } },
      orderBy: { startedAt: 'desc' },
      take: query.limit,
    });
  }

  async findOneOrThrow(id: string) {
    const job = await this.prisma.crawlJob.findUnique({
      where: { id },
      include: { source: { select: { id: true, name: true } } },
    });
    if (!job) {
      throw new NotFoundException('Crawl job not found');
    }
    return job;
  }
}
