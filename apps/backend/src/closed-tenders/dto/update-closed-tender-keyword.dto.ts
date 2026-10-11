import { PartialType } from '@nestjs/mapped-types';
import { CreateClosedTenderKeywordDto } from './create-closed-tender-keyword.dto';

export class UpdateClosedTenderKeywordDto extends PartialType(CreateClosedTenderKeywordDto) {}
