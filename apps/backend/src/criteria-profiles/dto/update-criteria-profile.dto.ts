import { PartialType } from '@nestjs/mapped-types';
import { CreateCriteriaProfileDto } from './create-criteria-profile.dto';

export class UpdateCriteriaProfileDto extends PartialType(CreateCriteriaProfileDto) {}
