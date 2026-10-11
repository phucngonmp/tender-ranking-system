import { Module } from '@nestjs/common';
import { CriteriaProfilesService } from './criteria-profiles.service';
import { CriteriaProfilesController } from './criteria-profiles.controller';

@Module({
  providers: [CriteriaProfilesService],
  controllers: [CriteriaProfilesController],
  exports: [CriteriaProfilesService],
})
export class CriteriaProfilesModule {}
