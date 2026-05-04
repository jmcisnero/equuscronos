import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VetInspectionsService } from './vet-inspections.service';
import { VetInspectionsController } from './vet-inspections.controller';
import { VetInspection } from '../competitions/entities/vet-inspection.entity';
import { TimingRecord } from '../competitions/entities/timing-record.entity';

@Module({
  imports: [TypeOrmModule.forFeature([VetInspection, TimingRecord])],
  controllers: [VetInspectionsController],
  providers: [VetInspectionsService],
})
export class VetInspectionsModule {}
