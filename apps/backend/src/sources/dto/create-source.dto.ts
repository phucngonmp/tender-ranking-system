import { SourceType } from '@prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';

export class CreateSourceDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsEnum(SourceType)
  sourceType?: SourceType;

  @ValidateIf((dto) => (dto.sourceType ?? SourceType.url) === SourceType.url)
  @IsUrl({ require_tld: false })
  url?: string;

  @ValidateIf((dto) => (dto.sourceType ?? SourceType.url) !== SourceType.url)
  @IsString()
  keyword?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(23)
  crawlHour?: number;

  // Ngưỡng giá trị gói thầu (VND) để lọc khi crawl — không set thì lấy tất cả.
  @IsOptional()
  @IsNumber()
  @Min(0)
  minValue?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  maxValue?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsBoolean()
  autoScore?: boolean;
}
