import { Type } from 'class-transformer';
import { IsEmail, IsInt, IsOptional, Min } from 'class-validator';

export class QueryEmailHistoriesDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 10;
}

export class QueryEmailHistoriesByRecipientDto extends QueryEmailHistoriesDto {
  @IsEmail()
  email: string;
}
