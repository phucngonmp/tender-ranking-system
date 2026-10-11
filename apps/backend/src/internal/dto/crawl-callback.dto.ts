import { Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';

export class RawTenderItemDto {
  @IsOptional()
  @IsString()
  external_code?: string;

  @IsOptional()
  @IsString()
  matched_keyword?: string;

  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  investor?: string;

  @IsOptional()
  @IsString()
  sector?: string;

  @IsOptional()
  estimated_value?: number;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsString()
  submission_open_date?: string;

  @IsOptional()
  @IsString()
  submission_deadline?: string;

  @IsOptional()
  @IsString()
  published_at?: string;

  @IsOptional()
  @IsString()
  locality?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  requirements_text?: string;

  @IsString()
  source_url: string;

  @IsOptional()
  hsmt_data?: any;

  @IsOptional()
  @IsArray()
  attachments?: any[];

  @IsOptional()
  @IsString()
  id?: string;

  @IsOptional()
  @IsString()
  processApply?: string;

  @IsOptional()
  @IsString()
  __notifyId__?: string;

  @IsOptional()
  @IsString()
  __id__?: string;

  @IsOptional()
  @IsString()
  __processApply__?: string;

  @IsOptional()
  @IsString()
  __bidField__?: string;

  @IsOptional()
  @IsString()
  __bidForm__?: string;
}

export class CrawlCallbackDto {
  @IsUUID()
  crawl_job_id: string;

  @IsUUID()
  source_id: string;

  @IsIn(['success', 'failed'])
  status: 'success' | 'failed';

  @IsOptional()
  @IsString()
  error_message?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RawTenderItemDto)
  items?: RawTenderItemDto[];
}
