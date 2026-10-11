import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { CrawlJobStatus } from '@prisma/client';

export class QueryCrawlJobsDto {
  @IsOptional()
  @IsString()
  source_id?: string;

  @IsOptional()
  @IsIn(Object.values(CrawlJobStatus))
  status?: CrawlJobStatus;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
