import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { TimingController } from "./timing.controller";
import { TimingService } from "./timing.service";
import { TimeCalculationService } from "./services/time-calculation.service";
import { RealTimeGateway } from "./real-time.gateway";
import { ControlClosureScheduler } from "./control-closure.scheduler";
import { TimingRecord } from "../competitions/entities/timing-record.entity";
import { CompetitionEntry } from "../competition-entries/entities/competition-entry.entity";
import { Stage } from "../competitions/entities/stage.entity";
import { VetInspection } from "../vet-inspections/entities/vet-inspection.entity";
import { Penalty } from "../competitions/entities/penalty.entity";
import { AdminContingencyController } from "./admin-contingency.controller";
import { AdminContingencyService } from "./admin-contingency.service";
import { LeaderboardModule } from "../leaderboard/leaderboard.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      TimingRecord,
      CompetitionEntry,
      Stage,
      VetInspection,
      Penalty,
    ]),
    LeaderboardModule,
  ],
  controllers: [TimingController, AdminContingencyController],
  providers: [
    TimingService,
    TimeCalculationService,
    RealTimeGateway,
    ControlClosureScheduler,
    AdminContingencyService,
  ],
  exports: [
    TimingService,
    RealTimeGateway,
    ControlClosureScheduler,
    AdminContingencyService,
  ],
})
export class TimingModule {}
