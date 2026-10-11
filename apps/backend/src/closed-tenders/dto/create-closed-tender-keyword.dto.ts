import { IsBoolean, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class CreateClosedTenderKeywordDto {
  // Id of an existing Source (sourceType = muasamcong_keyword) — its `keyword`
  // is copied in, so the admin never re-types a keyword that's already
  // configured on the "Nguồn crawl" page.
  @IsString()
  sourceId: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(23)
  crawlHour?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
