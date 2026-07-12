import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { VetInspectionsService } from "./vet-inspections.service";
import { VetInspectionsController } from "./vet-inspections.controller";
import { VetInspection } from "./entities/vet-inspection.entity";
import { TimingRecord } from "../competitions/entities/timing-record.entity";
import { TimingModule } from "../timing/timing.module";
import { LeaderboardModule } from "../leaderboard/leaderboard.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([VetInspection, TimingRecord]),
    TimingModule,
    LeaderboardModule,
  ],
  controllers: [VetInspectionsController],
  providers: [VetInspectionsService],
})
export class VetInspectionsModule {}
