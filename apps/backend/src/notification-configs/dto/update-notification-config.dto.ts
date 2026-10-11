import { IsArray, IsBoolean, IsInt, IsOptional, IsString, IsUrl } from 'class-validator';

export class UpdateNotificationConfigDto {
  @IsOptional()
  @IsBoolean()
  emailsEnabled?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  emailRecipients?: string[];

  @IsOptional()
  @IsBoolean()
  webhookEnabled?: boolean;

  @IsOptional()
  @IsString()
  webhookUrl?: string;

  @IsOptional()
  @IsString()
  webhookType?: string;

  @IsOptional()
  @IsInt()
  minScoreThreshold?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  allowedVerdicts?: string[];

  @IsOptional()
  @IsBoolean()
  includeAttachments?: boolean;

  @IsOptional()
  @IsBoolean()
  includeAiAnalysis?: boolean;
}
