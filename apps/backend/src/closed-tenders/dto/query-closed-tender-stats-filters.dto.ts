import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { ClosedTenderStatus } from '@prisma/client';

export class QueryClosedTenderStatsFiltersDto {
  @IsOptional()
  @IsString()
  keyword?: string;

  @IsOptional()
  @IsIn(Object.values(ClosedTenderStatus))
  status?: ClosedTenderStatus;

  /** Chỉ dùng cho /top-winners — khai báo ở đây để lọt qua whitelist chung khi
   * @Query() nhận toàn bộ query string của endpoint đó. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
