import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { ClosedTenderStatus } from '@prisma/client';

const SORTABLE_FIELDS = ['bid_count', 'win_count', 'win_rate', 'total_winning_value'] as const;

export class QueryClosedTenderCompaniesDto {
  @IsOptional()
  @IsString()
  keyword?: string;

  @IsOptional()
  @IsIn(Object.values(ClosedTenderStatus))
  status?: ClosedTenderStatus;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsIn(SORTABLE_FIELDS)
  sort?: (typeof SORTABLE_FIELDS)[number];

  @IsOptional()
  @IsIn(['asc', 'desc'])
  order?: 'asc' | 'desc';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
