import { ScoringCriteriaGroup, ScoringCriteriaTier, Tender } from '@prisma/client';

/**
 * Evaluates the admin-configurable scoring criteria (settings: groups+tiers)
 * against a tender. Deterministic — the only non-deterministic input is the
 * `classification` object, which comes from a single AI call upstream and is
 * persisted alongside the result so it can be replayed without calling AI again
 * (see ScoringService.rescoreRubric).
 */

export type DomainBucket =
  | 'admin_hr_realestate_manufacturing_service_tourism'
  | 'transport_construction_health'
  | 'security_defense'
  | 'other';

export interface RubricClassification {
  isDxProject: boolean;
  domainBucket: DomainBucket;
  bidGuaranteeMentioned: boolean;
  bidGuaranteeUnder100tr: boolean;
}

export type GroupWithTiers = ScoringCriteriaGroup & { tiers: ScoringCriteriaTier[] };

export type TenderFieldSource = Pick<
  Tender,
  | 'estimatedValue'
  | 'locality'
  | 'investor'
  | 'sector'
  | 'title'
  | 'requirementsText'
  | 'description'
  | 'publishedAt'
  | 'submissionDeadline'
>;

export interface CriterionOutcome {
  groupId: string;
  groupName: string;
  points: number;
  label: string;
  reasons?: string[]; // populated for flat_if_any groups
}

export interface StoredRubricBreakdown {
  groups: CriterionOutcome[];
  classification: RubricClassification;
}

export interface CriteriaScoreResult {
  total: number;
  breakdown: CriterionOutcome[];
}

// Virtual field: concatenates two text fields so a single list_match tier can
// search across both (used by the ISO-requirement bonus tier).
const VIRTUAL_FIELDS: Record<string, (tender: TenderFieldSource) => string> = {
  requirements_and_description: (tender) =>
    [tender.requirementsText, tender.description].filter(Boolean).join(' '),
};

function resolveFieldValue(tender: TenderFieldSource, targetField: string | null): string | number | null {
  if (!targetField) return null;
  if (targetField in VIRTUAL_FIELDS) {
    return VIRTUAL_FIELDS[targetField](tender);
  }
  const value = (tender as Record<string, unknown>)[targetField];
  if (value === null || value === undefined) return null;
  if (typeof value === 'object' && 'toNumber' in (value as any)) {
    return (value as any).toNumber(); // Prisma Decimal
  }
  return value as string | number;
}

function resolveAiValue(
  aiQuestionKey: string | null,
  classification: RubricClassification,
): boolean | string | null {
  switch (aiQuestionKey) {
    case 'project_type':
      return classification.isDxProject;
    case 'domain_bucket':
      return classification.domainBucket;
    case 'bid_guarantee_under_100tr':
      return classification.bidGuaranteeMentioned && classification.bidGuaranteeUnder100tr;
    default:
      return null;
  }
}

function tierMatches(
  tier: ScoringCriteriaTier,
  tender: TenderFieldSource,
  classification: RubricClassification,
): boolean {
  const config = (tier.config ?? {}) as Record<string, any>;

  switch (tier.evaluatorType) {
    case 'numeric_range': {
      const hasBound = config.min !== undefined || config.max !== undefined;
      if (!hasBound) return true; // wildcard "else" tier
      const raw = resolveFieldValue(tender, tier.targetField);
      if (raw === null) return false;
      const num = Number(raw);
      if (Number.isNaN(num)) return false;
      if (config.min !== undefined && (config.minExclusive ? num <= config.min : num < config.min)) {
        return false;
      }
      if (config.max !== undefined && (config.maxExclusive ? num >= config.max : num > config.max)) {
        return false;
      }
      return true;
    }
    case 'list_match': {
      const values: string[] = Array.isArray(config.values) ? config.values : [];
      if (values.length === 0) return true; // wildcard "else" tier
      const raw = resolveFieldValue(tender, tier.targetField);
      if (!raw) return false;
      const text = String(raw).toLowerCase();
      return values.some((v) => text.includes(String(v).toLowerCase()));
    }
    case 'date_diff_gte': {
      const days = typeof config.days === 'number' ? config.days : 14;
      if (!tender.publishedAt || !tender.submissionDeadline) return false;
      const diffDays =
        (tender.submissionDeadline.getTime() - tender.publishedAt.getTime()) / (1000 * 60 * 60 * 24);
      return diffDays >= days;
    }
    case 'ai_classification': {
      const actual = resolveAiValue(tier.aiQuestionKey, classification);
      return actual !== null && actual === config.aiValue;
    }
    default:
      return false;
  }
}

export function evaluateCriteriaGroups(
  tender: TenderFieldSource,
  classification: RubricClassification,
  groups: GroupWithTiers[],
): CriteriaScoreResult {
  const breakdown: CriterionOutcome[] = [];
  let total = 0;

  const activeGroups = [...groups].filter((g) => g.isActive).sort((a, b) => a.order - b.order);

  for (const group of activeGroups) {
    const tiers = [...group.tiers].sort((a, b) => a.order - b.order);

    if (group.aggregation === 'flat_if_any') {
      const reasons = tiers.filter((tier) => tierMatches(tier, tender, classification)).map((t) => t.label);
      const points = reasons.length > 0 ? group.bonusPoints ?? 0 : 0;
      breakdown.push({
        groupId: group.id,
        groupName: group.name,
        points,
        label: reasons.length > 0 ? 'Đạt ít nhất 1 tiêu chí phụ' : 'Không đạt tiêu chí phụ nào',
        reasons,
      });
      total += points;
    } else {
      const matched = tiers.find((tier) => tierMatches(tier, tender, classification));
      const points = matched?.points ?? 0;
      breakdown.push({
        groupId: group.id,
        groupName: group.name,
        points,
        label: matched?.label ?? 'Không xác định',
      });
      total += points;
    }
  }

  return { total, breakdown };
}
