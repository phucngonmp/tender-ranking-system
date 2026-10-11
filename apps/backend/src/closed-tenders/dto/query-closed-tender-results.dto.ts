import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { ClosedTenderStatus } from '@prisma/client';

const SORTABLE_FIELDS = [
  'notifyNo',
  'title',
  'investor',
  'status',
  'keyword',
  'numBidderJoin',
  'winningPrice',
  'lastUpdatedAt',
] as const;

export type ClosedTenderResultSortField = (typeof SORTABLE_FIELDS)[number];

export class QueryClosedTenderResultsDto {
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

  @IsOptional()
  @IsIn(SORTABLE_FIELDS)
  sort?: ClosedTenderResultSortField;

  @IsOptional()
  @IsIn(['asc', 'desc'])
  order?: 'asc' | 'desc';
}
