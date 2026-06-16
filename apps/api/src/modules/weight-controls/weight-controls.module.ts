import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { WeightControlsService } from "./weight-controls.service";
import { WeightControlsController } from "./weight-controls.controller";
import { WeightControl } from "./entities/weight-control.entity";
import { CompetitionEntry } from "../competition-entries/entities/competition-entry.entity";
import { Stage } from "../competitions/entities/stage.entity";

@Module({
  imports: [TypeOrmModule.forFeature([WeightControl, CompetitionEntry, Stage])],
  controllers: [WeightControlsController],
  providers: [WeightControlsService],
})
export class WeightControlsModule {}
