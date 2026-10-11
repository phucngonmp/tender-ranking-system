import { IsEnum, IsOptional, IsString } from 'class-validator';
import { ScoringStatus } from '@prisma/client';

export class QueryScoringHistoriesDto {
  @IsOptional()
  @IsString()
  tender_id?: string;

  @IsOptional()
  @IsEnum(ScoringStatus)
  status?: ScoringStatus;
}
