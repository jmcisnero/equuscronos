import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { DashboardController } from "./dashboard.controller";
import { DashboardService } from "./dashboard.service";
import { Horse } from "../horses/entities/horse.entity";
import { Rider } from "../riders/entities/rider.entity";
import { Owner } from "../owners/entities/owner.entity";
import { Competition } from "../competitions/entities/competition.entity";

@Module({
  imports: [TypeOrmModule.forFeature([Horse, Rider, Owner, Competition])],
  controllers: [DashboardController],
  providers: [DashboardService],
  exports: [DashboardService],
})
export class DashboardModule {}
