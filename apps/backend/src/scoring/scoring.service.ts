import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OpenAiScoringService } from './openai-scoring.service';
import { computeRuleScore, clampScore } from './rule-score.util';
import { evaluateCriteriaGroups, StoredRubricBreakdown } from './criteria-scoring.util';
import { ScoringCriteriaService } from '../scoring-criteria/scoring-criteria.service';

@Injectable()
export class ScoringService {
  private readonly logger = new Logger(ScoringService.name);

  constructor(
    private prisma: PrismaService,
    private openAiScoringService: OpenAiScoringService,
    private scoringCriteriaService: ScoringCriteriaService,
  ) {}

  async scoreTender(tenderId: string) {
    const tender = await this.prisma.tender.findUnique({ where: { id: tenderId } });
    if (!tender) {
      throw new NotFoundException('Tender not found');
    }

    const criteriaProfile = await this.prisma.criteriaProfile.findFirst({
      where: { isActive: true },
    });
    if (!criteriaProfile) {
      this.logger.warn(`No active profile — skipping scoring for tender ${tenderId}`);
      return null;
    }

    if (!this.openAiScoringService.isConfigured) {
      this.logger.warn(
        `AI scoring is disabled (no valid API key) — skipping scoring for tender ${tenderId}`,
      );
      return null;
    }

    const groups = await this.scoringCriteriaService.findAllGroups();
    const aiResult = await this.openAiScoringService.scoreTender(tender, criteriaProfile, groups);

    const ruleScore = computeRuleScore({
      tender,
      criteriaProfile,
      riskFlagsCount: aiResult.riskFlags.length,
    });

    const finalScore = clampScore(aiResult.score + ruleScore);

    const classification = {
      isDxProject: aiResult.isDxProject,
      domainBucket: aiResult.domainBucket,
      bidGuaranteeMentioned: aiResult.bidGuaranteeMentioned,
      bidGuaranteeUnder100tr: aiResult.bidGuaranteeUnder100tr,
    };
    const rubricResult = evaluateCriteriaGroups(tender, classification, groups);
    const storedBreakdown: StoredRubricBreakdown = { groups: rubricResult.breakdown, classification };

    return this.prisma.tenderScore.create({
      data: {
        tenderId: tender.id,
        criteriaProfileId: criteriaProfile.id,
        aiScore: clampScore(aiResult.score),
        verdict: aiResult.verdict,
        aiRationale: aiResult.reasoning?.trim() || `Đánh giá ${aiResult.verdict}: ${aiResult.score} điểm.`,
        matchedCriteria: aiResult.matchedCriteria,
        gaps: aiResult.gaps,
        riskFlags: aiResult.riskFlags,
        recommendedFocus: aiResult.recommendedFocus,
        ruleScore,
        finalScore,
        rubricScore: rubricResult.total,
        rubricBreakdown: storedBreakdown as any,
        modelUsed: this.openAiScoringService.modelName,
      },
    });
  }

  /**
   * Recomputes just the deterministic rubric score against the tender's
   * current data (locality, estimatedValue, dates, requirements text, ...)
   * and the CURRENT scoring criteria settings, reusing the AI classification
   * flags stored on the latest score. No AI call — for refreshing after
   * editing tender data or tweaking the rubric formula itself, without
   * re-running (and re-paying for) the full AI scoring.
   */
  async rescoreRubric(tenderId: string) {
    const tender = await this.prisma.tender.findUnique({ where: { id: tenderId } });
    if (!tender) {
      throw new NotFoundException('Tender not found');
    }

    const latestScore = await this.prisma.tenderScore.findFirst({
      where: { tenderId },
      orderBy: { scoredAt: 'desc' },
    });
    const classification = (latestScore?.rubricBreakdown as unknown as StoredRubricBreakdown | null)
      ?.classification;
    if (!latestScore || !classification) {
      throw new BadRequestException(
        'Gói thầu chưa có điểm AI để tái sử dụng phân loại — hãy chấm điểm lại đầy đủ trước.',
      );
    }

    const groups = await this.scoringCriteriaService.findAllGroups();
    const rubricResult = evaluateCriteriaGroups(tender, classification, groups);
    const storedBreakdown: StoredRubricBreakdown = { groups: rubricResult.breakdown, classification };

    return this.prisma.tenderScore.update({
      where: { id: latestScore.id },
      data: {
        rubricScore: rubricResult.total,
        rubricBreakdown: storedBreakdown as any,
      },
    });
  }
}
