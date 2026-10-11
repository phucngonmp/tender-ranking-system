import { CriteriaProfile, Tender } from '@prisma/client';

export interface RuleScoreInput {
  tender: Pick<Tender, 'submissionDeadline' | 'estimatedValue'>;
  criteriaProfile: Pick<CriteriaProfile, 'preferredValueMin' | 'preferredValueMax'>;
  riskFlagsCount: number;
}

const DEADLINE_URGENT_DAYS = 3;
const DEADLINE_SOON_DAYS = 7;
const DEADLINE_URGENT_PENALTY = -15;
const DEADLINE_SOON_PENALTY = -5;
const PREFERRED_VALUE_BONUS = 10;
const RISK_FLAG_PENALTY = -5;
const RISK_FLAG_PENALTY_CAP = -15;

/**
 * Rule-based adjustment applied on top of the AI score to produce final_score.
 * Kept pure/side-effect free so it can be unit tested without a DB.
 */
export function computeRuleScore(input: RuleScoreInput): number {
  let adjustment = 0;

  const { submissionDeadline } = input.tender;
  if (submissionDeadline) {
    const daysLeft = (submissionDeadline.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
    if (daysLeft < DEADLINE_URGENT_DAYS) {
      adjustment += DEADLINE_URGENT_PENALTY;
    } else if (daysLeft < DEADLINE_SOON_DAYS) {
      adjustment += DEADLINE_SOON_PENALTY;
    }
  }

  const { estimatedValue } = input.tender;
  const { preferredValueMin, preferredValueMax } = input.criteriaProfile;
  if (estimatedValue != null && preferredValueMin != null && preferredValueMax != null) {
    const value = Number(estimatedValue);
    const min = Number(preferredValueMin);
    const max = Number(preferredValueMax);
    if (value >= min && value <= max) {
      adjustment += PREFERRED_VALUE_BONUS;
    }
  }

  const riskPenalty = Math.max(input.riskFlagsCount * RISK_FLAG_PENALTY, RISK_FLAG_PENALTY_CAP);
  adjustment += riskPenalty;

  return adjustment;
}

export function clampScore(score: number): number {
  return Math.max(0, Math.min(100, Math.round(score)));
}
