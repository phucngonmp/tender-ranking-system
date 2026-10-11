import { IsString, IsNotEmpty } from 'class-validator';

export class RunCompetitorAssessmentDto {
  @IsString()
  @IsNotEmpty()
  company_key: string;
}
