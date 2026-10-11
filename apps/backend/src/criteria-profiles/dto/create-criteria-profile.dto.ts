import { IsArray, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateCriteriaProfileDto {
  @IsString()
  name: string;

  @IsArray()
  @IsString({ each: true })
  industries: string[];

  @IsArray()
  @IsString({ each: true })
  technologies: string[];

  @IsArray()
  @IsString({ each: true })
  products: string[];

  @IsArray()
  @IsString({ each: true })
  keywords: string[];

  @IsOptional()
  @IsNumber()
  @Min(0)
  preferredValueMin?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  preferredValueMax?: number;

  @IsOptional()
  @IsString()
  positioning?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  services?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  productsAndSolutions?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  industriesExperience?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  certifications?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  marketsAndLanguages?: string[];

  @IsOptional()
  @IsString()
  deliveryModel?: string;
}
