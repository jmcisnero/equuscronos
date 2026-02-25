import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TimingController } from './timing.controller';
import { TimingService } from './timing.service';
import { TimingRecord } from '../competitions/entities/timing-record.entity';
import { CompetitionEntry } from '../competitions/entities/competition-entry.entity';
import { Stage } from '../competitions/entities/stage.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([TimingRecord, CompetitionEntry, Stage])
  ],
  controllers: [TimingController],
  providers: [TimingService],
  exports: [TimingService],
})
export class TimingModule {}
