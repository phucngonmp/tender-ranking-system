import { PartialType } from '@nestjs/mapped-types';
import { CreateScoringCriteriaGroupDto } from './create-group.dto';

export class UpdateScoringCriteriaGroupDto extends PartialType(CreateScoringCriteriaGroupDto) {}
