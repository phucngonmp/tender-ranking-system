import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ClosedTenderResultSortField, QueryClosedTenderResultsDto } from './dto/query-closed-tender-results.dto';

function buildOrderBy(
  sort: ClosedTenderResultSortField | undefined,
  order: 'asc' | 'desc' | undefined,
): Prisma.ClosedTenderResultOrderByWithRelationInput {
  const dir = order ?? 'desc';
  switch (sort) {
    case 'notifyNo':
      return { notifyNo: dir };
    case 'title':
      return { title: dir };
    case 'investor':
      return { investor: dir };
    case 'status':
      return { status: dir };
    case 'keyword':
      return { keyword: { keyword: dir } };
    // Số nhà thầu bỏ thầu chỉ có đầy đủ ở bảng bidders (gói đã có KQLCNT) —
    // sắp theo số lượng nhà thầu ghi nhận được, gần đúng với cột hiển thị.
    case 'numBidderJoin':
      return { bidders: { _count: dir } };
    case 'winningPrice':
      return { winningPrice: dir };
    default:
      return { lastUpdatedAt: dir };
  }
}

@Injectable()
export class ClosedTenderResultsService {
  constructor(private prisma: PrismaService) {}

  async findAll(query: QueryClosedTenderResultsDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    // "keyword" ở đây là giá trị đã tách theo dấu phẩy (khớp với cột "Từ khoá
    // tìm kiếm" hiển thị matchedKeyword) — kết quả cũ chưa crawl lại (matchedKeyword
    // còn NULL) fallback so khớp theo cả chuỗi nguồn gốc, cùng nguyên tắc với báo cáo.
    const where: Prisma.ClosedTenderResultWhereInput = {
      status: query.status,
      title: query.search ? { contains: query.search, mode: 'insensitive' } : undefined,
      OR: query.keyword
        ? [{ matchedKeyword: query.keyword }, { matchedKeyword: null, keyword: { keyword: query.keyword } }]
        : undefined,
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.closedTenderResult.findMany({
        where,
        include: {
          keyword: { select: { id: true, keyword: true } },
          _count: { select: { bidders: true } },
        },
        orderBy: buildOrderBy(query.sort, query.order),
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.closedTenderResult.count({ where }),
    ]);

    return { data, pagination: { page, limit, total } };
  }

  async findOneOrThrow(id: string) {
    const result = await this.prisma.closedTenderResult.findUnique({
      where: { id },
      include: {
        keyword: { select: { id: true, keyword: true } },
        bidders: { orderBy: [{ isWinner: 'desc' }, { finalPrice: 'asc' }] },
      },
    });
    if (!result) {
      throw new NotFoundException('Closed tender result not found');
    }
    return result;
  }
}
