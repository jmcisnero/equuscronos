import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { CompetitionEntriesService } from "./competition-entries.service";
import { CompetitionEntriesController } from "./competition-entries.controller";
import { CompetitionEntry } from "./entities/competition-entry.entity";
import { Competition } from "../competitions/entities/competition.entity";
import { Rider } from "../riders/entities/rider.entity";
import { Horse } from "../horses/entities/horse.entity";
import { Tenant } from "../tenants/entities/tenant.entity";
import { WeightControl } from "../weight-controls/entities/weight-control.entity";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      CompetitionEntry,
      Competition,
      Rider,
      Horse,
      Tenant,
      WeightControl,
    ]),
  ],
  controllers: [CompetitionEntriesController],
  providers: [CompetitionEntriesService],
  exports: [CompetitionEntriesService],
})
export class CompetitionEntriesModule {}
