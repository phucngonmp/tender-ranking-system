import { ScoringAggregation } from '@prisma/client';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Min, ValidateIf } from 'class-validator';

export class CreateScoringCriteriaGroupDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsIn(['best_tier', 'flat_if_any'])
  aggregation?: ScoringAggregation;

  @ValidateIf((dto) => dto.aggregation === 'flat_if_any')
  @IsInt()
  @Min(0)
  bonusPoints?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
