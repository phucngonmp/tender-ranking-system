import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

const SORTABLE_FIELDS = [
  'final_score',
  'rubric_score',
  'submission_deadline',
  'submission_open_date',
  'published_at',
  'estimated_value',
  'first_seen_at',
  'title',
  'investor',
  'locality',
  'source_keyword',
] as const;

export class QueryTendersDto {
  @IsOptional()
  @IsIn(SORTABLE_FIELDS)
  sort?: (typeof SORTABLE_FIELDS)[number] = 'final_score';

  @IsOptional()
  @IsIn(['asc', 'desc'])
  order?: 'asc' | 'desc' = 'desc';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  min_score?: number;

  @IsOptional()
  @IsString()
  sector?: string;

  @IsOptional()
  @IsString()
  locality?: string;

  @IsOptional()
  @IsString()
  source_id?: string;

  @IsOptional()
  @IsString()
  keyword?: string;

  @IsOptional()
  @IsIn(['open', 'closed'])
  status?: 'open' | 'closed';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}
