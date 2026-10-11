import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { ClosedTenderStatus } from '@prisma/client';

export class ClosedTenderBidderDto {
  @IsOptional()
  @IsString()
  org_code?: string;

  @IsString()
  org_fullname: string;

  @IsOptional()
  @IsString()
  tax_code?: string;

  @IsOptional()
  bid_price?: number;

  @IsOptional()
  final_price?: number;

  @IsOptional()
  @IsBoolean()
  is_winner?: boolean;

  @IsOptional()
  winning_price?: number;

  @IsOptional()
  @IsString()
  rank_or_reason?: string;

  @IsOptional()
  @IsString()
  execution_time?: string;

  @IsOptional()
  @IsString()
  contract_period_text?: string;
}

export class ClosedTenderResultItemDto {
  @IsString()
  notify_no: string;

  @IsOptional()
  @IsString()
  notify_id?: string;

  @IsOptional()
  @IsString()
  input_result_id?: string;

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
  investor_code?: string;

  @IsOptional()
  @IsString()
  bid_field?: string;

  @IsOptional()
  @IsString()
  locality?: string;

  @IsOptional()
  estimated_value?: number;

  @IsOptional()
  @IsString()
  bid_close_date?: string;

  @IsOptional()
  @IsString()
  bid_open_date?: string;

  @IsIn(Object.values(ClosedTenderStatus))
  status: ClosedTenderStatus;

  @IsOptional()
  num_bidder_join?: number;

  @IsOptional()
  @IsString()
  decision_no?: string;

  @IsOptional()
  @IsString()
  decision_date?: string;

  @IsOptional()
  @IsString()
  decision_agency?: string;

  @IsOptional()
  @IsString()
  decision_file_id?: string;

  @IsOptional()
  @IsString()
  decision_file_name?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  winning_contractor_names?: string[];

  @IsOptional()
  winning_price?: number;

  @IsString()
  source_url: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ClosedTenderBidderDto)
  bidders?: ClosedTenderBidderDto[];
}

export class ClosedTenderCallbackDto {
  @IsUUID()
  crawl_job_id: string;

  @IsUUID()
  keyword_id: string;

  @IsIn(['success', 'failed'])
  status: 'success' | 'failed';

  @IsOptional()
  @IsString()
  error_message?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ClosedTenderResultItemDto)
  results?: ClosedTenderResultItemDto[];
}
