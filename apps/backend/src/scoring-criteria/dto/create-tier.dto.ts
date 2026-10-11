import { ScoringEvaluatorType } from '@prisma/client';
import { IsIn, IsInt, IsObject, IsOptional, IsString, ValidateIf } from 'class-validator';
import { ALLOWED_AI_QUESTION_KEYS, ALLOWED_TARGET_FIELDS } from '../scoring-criteria.constants';

const EVALUATOR_TYPES = ['numeric_range', 'list_match', 'date_diff_gte', 'ai_classification'];
const TARGET_FIELD_VALUES = ALLOWED_TARGET_FIELDS.map((f) => f.value);
const AI_QUESTION_KEY_VALUES = ALLOWED_AI_QUESTION_KEYS.map((f) => f.value);

export class CreateScoringCriteriaTierDto {
  @IsString()
  label: string;

  @IsInt()
  points: number;

  @IsIn(EVALUATOR_TYPES)
  evaluatorType: ScoringEvaluatorType;

  @ValidateIf((dto) => dto.evaluatorType === 'numeric_range' || dto.evaluatorType === 'list_match')
  @IsIn(TARGET_FIELD_VALUES)
  targetField?: string;

  @ValidateIf((dto) => dto.evaluatorType === 'ai_classification')
  @IsIn(AI_QUESTION_KEY_VALUES)
  aiQuestionKey?: string;

  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;
}
