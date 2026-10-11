import { Module } from '@nestjs/common';
import { ScoringCriteriaService } from './scoring-criteria.service';
import { ScoringCriteriaController } from './scoring-criteria.controller';

@Module({
  providers: [ScoringCriteriaService],
  controllers: [ScoringCriteriaController],
  exports: [ScoringCriteriaService],
})
export class ScoringCriteriaModule {}
