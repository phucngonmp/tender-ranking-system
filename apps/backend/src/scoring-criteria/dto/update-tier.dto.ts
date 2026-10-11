import { PartialType } from '@nestjs/mapped-types';
import { CreateScoringCriteriaTierDto } from './create-tier.dto';

export class UpdateScoringCriteriaTierDto extends PartialType(CreateScoringCriteriaTierDto) {}
