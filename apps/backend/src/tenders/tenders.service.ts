import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { QueryTendersDto } from './dto/query-tenders.dto';
import { ScoringQueueService } from '../queue/scoring-queue.service';
import { ScoringService } from '../scoring/scoring.service';
import { StreamableFile } from '@nestjs/common';
import { createReadStream, existsSync } from 'fs';

const SORT_COLUMN_MAP: Record<string, string> = {
  final_score: 'ls.final_score',
  rubric_score: 'ls.rubric_score',
  submission_deadline: 't.submission_deadline',
  submission_open_date: 't.submission_open_date',
  published_at: 't.published_at',
  estimated_value: 't.estimated_value',
  first_seen_at: 't.first_seen_at',
  title: 't.title',
  investor: 't.investor',
  locality: 't.locality',
  source_keyword: 't.matched_keyword',
};

interface TenderListRow {
  id: string;
  source_id: string;
  source_name: string;
  source_keyword: string | null;
  external_code: string | null;
  title: string;
  investor: string | null;
  sector: string | null;
  estimated_value: string | null;
  currency: string | null;
  submission_open_date: Date | null;
  submission_deadline: Date | null;
  published_at: Date | null;
  locality: string | null;
  source_url: string;
  first_seen_at: Date;
  last_updated_at: Date;
  final_score: number | null;
  ai_score: number | null;
  verdict: string | null;
  scored_at: Date | null;
  rubric_score: number | null;
  rubric_breakdown: unknown;
}

@Injectable()
export class TendersService {
  constructor(
    private prisma: PrismaService,
    private scoringQueue: ScoringQueueService,
    private scoringService: ScoringService,
  ) {}

  /** Mốc thời gian crawl gần nhất trong số các nguồn đang theo dõi — hiển thị
   * cho người dùng biết dữ liệu gói thầu đang xem tính đến lúc nào. */
  async getDataFreshness() {
    const result = await this.prisma.source.aggregate({
      _max: { lastCrawledAt: true },
    });
    return { lastCrawledAt: result._max.lastCrawledAt };
  }

  async findAll(query: QueryTendersDto) {
    const sortColumn = SORT_COLUMN_MAP[query.sort ?? 'final_score'];
    const order = query.order === 'asc' ? Prisma.sql`ASC` : Prisma.sql`DESC`;
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const offset = (page - 1) * limit;

    const sectorFilter = query.sector
      ? Prisma.sql`AND t.sector = ${query.sector}`
      : Prisma.empty;
    const minScoreFilter =
      query.min_score !== undefined
        ? Prisma.sql`AND ls.final_score >= ${query.min_score}`
        : Prisma.empty;
    const localityFilter = query.locality
      ? Prisma.sql`AND t.locality ILIKE ${'%' + query.locality + '%'}`
      : Prisma.empty;
    const sourceIdFilter = query.source_id
      ? Prisma.sql`AND t.source_id = ${query.source_id}`
      : Prisma.empty;
    const keywordFilter = query.keyword
      ? Prisma.sql`AND (
          t.title ILIKE ${'%' + query.keyword + '%'}
          OR t.external_code ILIKE ${'%' + query.keyword + '%'}
          OR t.investor ILIKE ${'%' + query.keyword + '%'}
          OR t.matched_keyword ILIKE ${'%' + query.keyword + '%'}
        )`
      : Prisma.empty;
    const statusFilter =
      query.status === 'open'
        ? Prisma.sql`AND t.submission_deadline > NOW()`
        : query.status === 'closed'
          ? Prisma.sql`AND t.submission_deadline <= NOW()`
          : Prisma.empty;

    const rows = await this.prisma.$queryRaw<TenderListRow[]>`
      SELECT t.id, t.source_id, s.name AS source_name, t.matched_keyword AS source_keyword, t.external_code, t.title, t.investor, t.sector,
             t.estimated_value, t.currency, t.submission_open_date, t.submission_deadline, t.published_at,
             t.locality, t.source_url, t.first_seen_at, t.last_updated_at,
             ls.final_score, ls.ai_score, ls.verdict, ls.scored_at, ls.rubric_score, ls.rubric_breakdown
      FROM tenders t
      JOIN sources s ON s.id = t.source_id
      LEFT JOIN LATERAL (
        SELECT * FROM tender_scores ts
        WHERE ts.tender_id = t.id
        ORDER BY ts.scored_at DESC
        LIMIT 1
      ) ls ON true
      WHERE 1=1 ${sectorFilter} ${minScoreFilter} ${localityFilter} ${sourceIdFilter} ${keywordFilter} ${statusFilter}
      ORDER BY ${Prisma.raw(sortColumn)} ${order} NULLS LAST
      LIMIT ${limit} OFFSET ${offset}
    `;

    const countRows = await this.prisma.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*)::bigint as count
      FROM tenders t
      JOIN sources s ON s.id = t.source_id
      LEFT JOIN LATERAL (
        SELECT final_score FROM tender_scores ts
        WHERE ts.tender_id = t.id
        ORDER BY ts.scored_at DESC
        LIMIT 1
      ) ls ON true
      WHERE 1=1 ${sectorFilter} ${minScoreFilter} ${localityFilter} ${sourceIdFilter} ${keywordFilter} ${statusFilter}
    `;

    return {
      data: rows,
      pagination: {
        page,
        limit,
        total: Number(countRows[0]?.count ?? 0),
      },
    };
  }

  async findOneOrThrow(id: string) {
    const tender = await this.prisma.tender.findUnique({
      where: { id },
      include: {
        scores: { orderBy: { scoredAt: 'desc' }, take: 1 },
        source: { select: { id: true, name: true, url: true, sourceType: true } },
        attachments: true,
      },
    });
    if (!tender) {
      throw new NotFoundException('Tender not found');
    }
    return tender;
  }

  async findEmailHistories(tenderId: string, page: number, limit: number) {
    const [data, total] = await this.prisma.$transaction([
      this.prisma.tenderEmailHistory.findMany({
        where: { tenderId },
        orderBy: { sentAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.tenderEmailHistory.count({ where: { tenderId } }),
    ]);
    return { data, meta: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) } };
  }

  async findAllTendersWithEmailHistories(page: number, limit: number) {
    const where = { emailHistories: { some: {} } };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.tender.findMany({
        where,
        include: { emailHistories: { orderBy: { sentAt: 'desc' } } },
        orderBy: { lastUpdatedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.tender.count({ where }),
    ]);
    return { data, meta: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) } };
  }

  async findEmailHistoriesByRecipient(email: string, page: number, limit: number) {
    const where = { recipient: email };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.tenderEmailHistory.findMany({
        where,
        include: { tender: { select: { id: true, title: true } } },
        orderBy: { sentAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.tenderEmailHistory.count({ where }),
    ]);
    return { data, meta: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) } };
  }

  async rescore(id: string) {
    await this.findOneOrThrow(id);
    await this.scoringQueue.enqueue({ tenderId: id });
    return { queued: true };
  }

  async rescoreRubric(id: string) {
    await this.findOneOrThrow(id);
    return this.scoringService.rescoreRubric(id);
  }

  async downloadAttachment(tenderId: string, attachmentId: string): Promise<{ storagePath: string, filename: string }> {
    const attachment = await this.prisma.tenderAttachment.findFirst({
      where: {
        id: attachmentId,
        tenderId,
      }
    });

    if (!attachment) {
      throw new NotFoundException('Attachment not found');
    }

    if (!attachment.storagePath || !existsSync(attachment.storagePath)) {
      throw new NotFoundException('File has not been downloaded yet or is missing');
    }

    return {
      storagePath: attachment.storagePath,
      filename: attachment.fileName,
    };
  }
}
