import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ClosedTenderStatsService } from './closed-tender-stats.service';
import { OpenAiCompetitorAssessmentService } from './openai-competitor-assessment.service';

const COMPANY_KEY_SQL = Prisma.sql`COALESCE(NULLIF(TRIM(b.tax_code), ''), LOWER(TRIM(b.org_fullname)))`;

@Injectable()
export class CompetitorAssessmentService {
  constructor(
    private prisma: PrismaService,
    private statsService: ClosedTenderStatsService,
    private openAiCompetitorAssessment: OpenAiCompetitorAssessmentService,
  ) {}

  getCached(companyKey: string) {
    return this.prisma.competitorAssessment.findUnique({ where: { companyKey } });
  }

  /** Tổng hợp thông tin đối thủ từ dữ liệu KQĐT đã crawl (thống kê + mẫu tên gói
   * thầu gần đây), lấy hồ sơ công ty đang active, gọi AI (có tìm kiếm web + trích
   * dẫn nguồn), rồi lưu đè (upsert) vào cache theo companyKey. */
  async runAssessment(companyKey: string, requestedBy: string | null) {
    const profile = await this.statsService.getCompanyProfile(companyKey);
    if (!profile) {
      throw new NotFoundException('Không tìm thấy công ty này trong dữ liệu KQĐT.');
    }

    const titleRows = await this.prisma.$queryRaw<{ title: string }[]>`
      SELECT r.title
      FROM closed_tender_bidders b
      JOIN closed_tender_results r ON r.id = b.result_id
      WHERE ${COMPANY_KEY_SQL} = ${companyKey}
      ORDER BY r.bid_close_date DESC NULLS LAST
      LIMIT 15
    `;

    const activeProfile = await this.prisma.criteriaProfile.findFirst({ where: { isActive: true } });
    if (!activeProfile) {
      throw new NotFoundException(
        'Chưa có Hồ sơ công ty nào đang active — vào mục "Hồ sơ công ty" để cấu hình trước khi đánh giá đối thủ.',
      );
    }

    const { result, sources, usage } = await this.openAiCompetitorAssessment.assessCompetitor(
      {
        orgFullname: profile.orgFullname,
        taxCode: profile.taxCode,
        bidCount: profile.bidCount,
        winCount: profile.winCount,
        winRate: profile.winRate,
        totalWinningValue: profile.totalWinningValue,
        keywords: profile.keywords,
        sampleTenderTitles: titleRows.map((t) => t.title),
      },
      activeProfile,
    );

    const data = {
      taxCode: profile.taxCode,
      orgFullname: profile.orgFullname,
      threatLevel: result.threatLevel,
      companySummary: result.companySummary,
      strengths: result.strengths,
      weaknesses: result.weaknesses,
      overlapWithUs: result.overlapWithUs,
      recommendations: result.recommendations,
      fullAnalysis: result.fullAnalysis,
      sources: sources as unknown as Prisma.InputJsonValue,
      modelUsed: this.openAiCompetitorAssessment.modelName,
      promptTokens: usage.promptTokens,
      completionTokens: usage.completionTokens,
      totalTokens: usage.totalTokens,
      requestedBy,
    };

    return this.prisma.competitorAssessment.upsert({
      where: { companyKey },
      create: { companyKey, ...data },
      update: data,
    });
  }
}
