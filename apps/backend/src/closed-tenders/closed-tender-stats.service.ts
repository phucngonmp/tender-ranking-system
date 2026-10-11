import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { QueryClosedTenderCompaniesDto } from './dto/query-closed-tender-companies.dto';
import { QueryClosedTenderStatsFiltersDto } from './dto/query-closed-tender-stats-filters.dto';

interface SummaryRow {
  total_tenders: bigint;
  awarded_tenders: bigint;
  under_evaluation_tenders: bigint;
  total_winning_value: string | null;
}

interface CompanyCountRow {
  total_companies: bigint;
}

interface ByKeywordRow {
  keyword_id: string;
  keyword: string;
  total_count: bigint;
  awarded_count: bigint;
  under_evaluation_count: bigint;
  total_winning_value: string | null;
}

interface CompanyRow {
  company_key: string;
  tax_code: string | null;
  org_fullname: string;
  bid_count: bigint;
  win_count: bigint;
  total_winning_value: string | null;
  keyword_count: bigint;
  win_rate: string;
  keywords?: (string | null)[] | null;
}

const COMPANY_SORT_COLUMN: Record<string, string> = {
  bid_count: 'bid_count',
  win_count: 'win_count',
  win_rate: 'win_rate',
  total_winning_value: 'total_winning_value',
};

/** Nhóm nhà thầu theo mã số thuế (đáng tin cậy hơn tên công ty, vốn có thể lệch
 * chính tả/khoảng trắng giữa các lần crawl khác nhau) — chỉ fallback về tên khi
 * thiếu mã số thuế. */
const COMPANY_KEY_SQL = Prisma.sql`COALESCE(NULLIF(TRIM(b.tax_code), ''), LOWER(TRIM(b.org_fullname)))`;

@Injectable()
export class ClosedTenderStatsService {
  constructor(private prisma: PrismaService) {}

  /** Mốc thời gian crawl gần nhất trong số các từ khoá KQĐT đang theo dõi —
   * hiển thị cho người dùng biết dữ liệu đang xem tính đến lúc nào. */
  async getDataFreshness() {
    const result = await this.prisma.closedTenderKeyword.aggregate({
      _max: { lastCrawledAt: true },
    });
    return { lastCrawledAt: result._max.lastCrawledAt };
  }

  /** Điều kiện lọc theo từ khoá đã tách (matched_keyword) và trạng thái, dùng
   * chung cho summary/top-winners/companies — đòi hỏi các truy vấn join sẵn
   * `closed_tender_results r` và `closed_tender_keywords k`. */
  private buildResultFilters(filters: QueryClosedTenderStatsFiltersDto) {
    const keywordFilter = filters.keyword
      ? Prisma.sql`AND COALESCE(r.matched_keyword, k.keyword) = ${filters.keyword}`
      : Prisma.empty;
    const statusFilter = filters.status
      ? Prisma.sql`AND r.status = ${filters.status}::"ClosedTenderStatus"`
      : Prisma.empty;
    return { keywordFilter, statusFilter };
  }

  async getSummary(filters: QueryClosedTenderStatsFiltersDto = {}) {
    const { keywordFilter, statusFilter } = this.buildResultFilters(filters);

    const [tenderRows, companyRows] = await Promise.all([
      this.prisma.$queryRaw<SummaryRow[]>`
        SELECT
          count(*) AS total_tenders,
          count(*) FILTER (WHERE r.status = 'awarded') AS awarded_tenders,
          count(*) FILTER (WHERE r.status = 'under_evaluation') AS under_evaluation_tenders,
          COALESCE(SUM(r.winning_price) FILTER (WHERE r.status = 'awarded'), 0) AS total_winning_value
        FROM closed_tender_results r
        JOIN closed_tender_keywords k ON k.id = r.keyword_id
        WHERE 1 = 1 ${keywordFilter} ${statusFilter}
      `,
      this.prisma.$queryRaw<CompanyCountRow[]>`
        SELECT count(DISTINCT ${COMPANY_KEY_SQL})::bigint AS total_companies
        FROM closed_tender_bidders b
        JOIN closed_tender_results r ON r.id = b.result_id
        JOIN closed_tender_keywords k ON k.id = r.keyword_id
        WHERE 1 = 1 ${keywordFilter} ${statusFilter}
      `,
    ]);

    const t = tenderRows[0];
    return {
      totalTenders: Number(t?.total_tenders ?? 0),
      awardedTenders: Number(t?.awarded_tenders ?? 0),
      underEvaluationTenders: Number(t?.under_evaluation_tenders ?? 0),
      totalWinningValue: t?.total_winning_value ?? '0',
      totalCompanies: Number(companyRows[0]?.total_companies ?? 0),
    };
  }

  /** Nhóm theo từ khoá đã tách theo dấu phẩy (matched_keyword của từng kết quả) —
   * cùng nguyên tắc tách từ khoá lúc crawl — thay vì gộp chung theo cả chuỗi
   * ClosedTenderKeyword.keyword gốc. Kết quả cũ chưa crawl lại (matched_keyword
   * còn NULL) tạm hiển thị theo chuỗi gốc cho tới lần crawl kế tiếp. */
  async getByKeyword() {
    const rows = await this.prisma.$queryRaw<ByKeywordRow[]>`
      SELECT COALESCE(r.matched_keyword, k.keyword) AS keyword,
        MAX(k.id) AS keyword_id,
        count(r.id) AS total_count,
        count(*) FILTER (WHERE r.status = 'awarded') AS awarded_count,
        count(*) FILTER (WHERE r.status = 'under_evaluation') AS under_evaluation_count,
        COALESCE(SUM(r.winning_price) FILTER (WHERE r.status = 'awarded'), 0) AS total_winning_value
      FROM closed_tender_keywords k
      LEFT JOIN closed_tender_results r ON r.keyword_id = k.id
      GROUP BY COALESCE(r.matched_keyword, k.keyword)
      ORDER BY total_count DESC
    `;

    return rows.map((r) => ({
      keywordId: r.keyword_id,
      keyword: r.keyword,
      totalCount: Number(r.total_count),
      awardedCount: Number(r.awarded_count),
      underEvaluationCount: Number(r.under_evaluation_count),
      totalWinningValue: r.total_winning_value ?? '0',
    }));
  }

  async getCompanies(query: QueryClosedTenderCompaniesDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const sortColumn = COMPANY_SORT_COLUMN[query.sort ?? 'win_count'] ?? 'win_count';
    const order = query.order === 'asc' ? Prisma.sql`ASC` : Prisma.sql`DESC`;

    const { keywordFilter, statusFilter } = this.buildResultFilters(query);
    const searchFilter = query.search
      ? Prisma.sql`AND b.org_fullname ILIKE ${'%' + query.search + '%'}`
      : Prisma.empty;

    const rows = await this.prisma.$queryRaw<CompanyRow[]>`
      WITH company_agg AS (
        SELECT
          ${COMPANY_KEY_SQL} AS company_key,
          MAX(b.tax_code) AS tax_code,
          MAX(b.org_fullname) AS org_fullname,
          count(*) AS bid_count,
          count(*) FILTER (WHERE b.is_winner) AS win_count,
          COALESCE(SUM(b.winning_price) FILTER (WHERE b.is_winner), 0) AS total_winning_value,
          count(DISTINCT COALESCE(r.matched_keyword, k.keyword)) AS keyword_count
        FROM closed_tender_bidders b
        JOIN closed_tender_results r ON r.id = b.result_id
        JOIN closed_tender_keywords k ON k.id = r.keyword_id
        WHERE 1 = 1 ${keywordFilter} ${statusFilter} ${searchFilter}
        GROUP BY company_key
      )
      SELECT *,
        CASE WHEN bid_count > 0 THEN ROUND(win_count::numeric / bid_count * 100, 1) ELSE 0 END AS win_rate
      FROM company_agg
      ORDER BY ${Prisma.raw(sortColumn)} ${order} NULLS LAST, bid_count DESC
      LIMIT ${limit} OFFSET ${(page - 1) * limit}
    `;

    const countRows = await this.prisma.$queryRaw<{ count: bigint }[]>`
      SELECT count(DISTINCT ${COMPANY_KEY_SQL})::bigint AS count
      FROM closed_tender_bidders b
      JOIN closed_tender_results r ON r.id = b.result_id
      JOIN closed_tender_keywords k ON k.id = r.keyword_id
      WHERE 1 = 1 ${keywordFilter} ${statusFilter} ${searchFilter}
    `;

    return {
      data: rows.map((r) => ({
        companyKey: r.company_key,
        taxCode: r.tax_code,
        orgFullname: r.org_fullname,
        bidCount: Number(r.bid_count),
        winCount: Number(r.win_count),
        winRate: Number(r.win_rate),
        totalWinningValue: r.total_winning_value ?? '0',
        keywordCount: Number(r.keyword_count),
      })),
      pagination: { page, limit, total: Number(countRows[0]?.count ?? 0) },
    };
  }

  async getTopWinners(limit = 10, filters: QueryClosedTenderStatsFiltersDto = {}) {
    const { keywordFilter, statusFilter } = this.buildResultFilters(filters);

    const rows = await this.prisma.$queryRaw<CompanyRow[]>`
      WITH company_agg AS (
        SELECT
          ${COMPANY_KEY_SQL} AS company_key,
          MAX(b.tax_code) AS tax_code,
          MAX(b.org_fullname) AS org_fullname,
          count(*) AS bid_count,
          count(*) FILTER (WHERE b.is_winner) AS win_count,
          COALESCE(SUM(b.winning_price) FILTER (WHERE b.is_winner), 0) AS total_winning_value,
          count(DISTINCT COALESCE(r.matched_keyword, k.keyword)) AS keyword_count
        FROM closed_tender_bidders b
        JOIN closed_tender_results r ON r.id = b.result_id
        JOIN closed_tender_keywords k ON k.id = r.keyword_id
        WHERE 1 = 1 ${keywordFilter} ${statusFilter}
        GROUP BY company_key
      )
      SELECT *,
        CASE WHEN bid_count > 0 THEN ROUND(win_count::numeric / bid_count * 100, 1) ELSE 0 END AS win_rate
      FROM company_agg
      WHERE win_count > 0
      ORDER BY win_count DESC, total_winning_value DESC
      LIMIT ${limit}
    `;

    return rows.map((r) => ({
      companyKey: r.company_key,
      taxCode: r.tax_code,
      orgFullname: r.org_fullname,
      bidCount: Number(r.bid_count),
      winCount: Number(r.win_count),
      winRate: Number(r.win_rate),
      totalWinningValue: r.total_winning_value ?? '0',
      keywordCount: Number(r.keyword_count),
    }));
  }

  async getCompanyTenders(companyKey: string) {
    const rows = await this.prisma.$queryRaw<
      {
        id: string;
        notify_no: string;
        title: string;
        investor: string | null;
        status: string;
        keyword: string;
        bid_price: string | null;
        final_price: string | null;
        is_winner: boolean;
        winning_price: string | null;
        rank_or_reason: string | null;
        bid_close_date: Date | null;
      }[]
    >`
      SELECT r.id, r.notify_no, r.title, r.investor, r.status, COALESCE(r.matched_keyword, k.keyword) AS keyword,
        b.bid_price, b.final_price, b.is_winner, b.winning_price, b.rank_or_reason,
        r.bid_close_date
      FROM closed_tender_bidders b
      JOIN closed_tender_results r ON r.id = b.result_id
      JOIN closed_tender_keywords k ON k.id = r.keyword_id
      WHERE ${COMPANY_KEY_SQL} = ${companyKey}
      ORDER BY r.bid_close_date DESC NULLS LAST
    `;

    return rows.map((r) => ({
      id: r.id,
      notifyNo: r.notify_no,
      title: r.title,
      investor: r.investor,
      status: r.status,
      keyword: r.keyword,
      bidPrice: r.bid_price,
      finalPrice: r.final_price,
      isWinner: r.is_winner,
      winningPrice: r.winning_price,
      rankOrReason: r.rank_or_reason,
      bidCloseDate: r.bid_close_date,
    }));
  }

  /** Hồ sơ tổng hợp 1 công ty (dùng cho trang dashboard phân tích đối thủ và
   * để CompetitorAssessmentService lấy dữ liệu đưa vào prompt AI). */
  async getCompanyProfile(companyKey: string) {
    const [row] = await this.prisma.$queryRaw<CompanyRow[]>`
      WITH company_agg AS (
        SELECT
          ${COMPANY_KEY_SQL} AS company_key,
          MAX(b.tax_code) AS tax_code,
          MAX(b.org_fullname) AS org_fullname,
          count(*) AS bid_count,
          count(*) FILTER (WHERE b.is_winner) AS win_count,
          COALESCE(SUM(b.winning_price) FILTER (WHERE b.is_winner), 0) AS total_winning_value,
          array_agg(DISTINCT COALESCE(r.matched_keyword, k.keyword)) AS keywords
        FROM closed_tender_bidders b
        JOIN closed_tender_results r ON r.id = b.result_id
        JOIN closed_tender_keywords k ON k.id = r.keyword_id
        WHERE ${COMPANY_KEY_SQL} = ${companyKey}
        GROUP BY company_key
      )
      SELECT *,
        cardinality(keywords) AS keyword_count,
        CASE WHEN bid_count > 0 THEN ROUND(win_count::numeric / bid_count * 100, 1) ELSE 0 END AS win_rate
      FROM company_agg
    `;

    if (!row) return null;

    return {
      companyKey: row.company_key,
      taxCode: row.tax_code,
      orgFullname: row.org_fullname,
      bidCount: Number(row.bid_count),
      winCount: Number(row.win_count),
      winRate: Number(row.win_rate),
      totalWinningValue: row.total_winning_value ?? '0',
      keywordCount: Number(row.keyword_count),
      keywords: (row.keywords ?? []).filter((k): k is string => Boolean(k)),
    };
  }
}
