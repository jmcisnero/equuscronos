import { Module, forwardRef } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { CacheModule } from "@nestjs/cache-manager";
import { CompetitionEntry } from "../competition-entries/entities/competition-entry.entity";
import { LeaderboardController } from "./leaderboard.controller";
import { LeaderboardService } from "./leaderboard.service";
import { TimingModule } from "../timing/timing.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([CompetitionEntry]),
    CacheModule.register(),
    forwardRef(() => TimingModule),
  ],
  controllers: [LeaderboardController],
  providers: [LeaderboardService],
  exports: [LeaderboardService],
})
export class LeaderboardModule {}

