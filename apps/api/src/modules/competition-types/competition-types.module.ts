import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CompetitionTypesService } from './competition-types.service';
import { CompetitionTypesController } from './competition-types.controller';
import { CompetitionType } from './entities/competition-type.entity';

@Module({
  imports: [TypeOrmModule.forFeature([CompetitionType])],
  controllers: [CompetitionTypesController],
  providers: [CompetitionTypesService],
  exports: [CompetitionTypesService],
})
export class CompetitionTypesModule {}
