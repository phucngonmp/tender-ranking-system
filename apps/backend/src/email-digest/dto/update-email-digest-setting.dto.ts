import { IsArray, IsBoolean, IsEmail, IsInt, IsOptional, Max, Min } from 'class-validator';

export class UpdateEmailDigestSettingDto {
  @IsOptional()
  @IsArray()
  @IsEmail({}, { each: true })
  recipients?: string[];

  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(23)
  sendHour?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(59)
  sendMinute?: number;

  // null = no threshold (include all open tenders regardless of score)
  @IsOptional()
  @IsInt()
  @Min(0)
  minScore?: number | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  topCount?: number;
}
