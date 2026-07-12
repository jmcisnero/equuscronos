import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { DataSource, LessThanOrEqual } from "typeorm";
import { Competition } from "../competitions/entities/competition.entity";
import { Stage } from "../competitions/entities/stage.entity";
import { CompetitionEntry } from "../competition-entries/entities/competition-entry.entity";
import { CompetitionStatus, ParticipantStatus } from "@equuscronos/shared";
import { RealTimeGateway } from "./real-time.gateway";

@Injectable()
export class ControlClosureScheduler {
  private readonly logger = new Logger(ControlClosureScheduler.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly realTimeGateway: RealTimeGateway,
  ) {}

  @Cron(CronExpression.EVERY_10_SECONDS)
  async checkControlClosures() {
    const now = new Date();

    // Find all competitions that are active and whose control closure time has passed
    const expiredCompetitions = await this.dataSource
      .getRepository(Competition)
      .find({
        where: {
          status: CompetitionStatus.ACTIVE,
          controlClosureTime: LessThanOrEqual(now),
        },
      });

    if (expiredCompetitions.length === 0) {
      return;
    }

    for (const comp of expiredCompetitions) {
      this.logger.log(
        `[Control Closure] Competition ${comp.name} (${comp.id}) reached its control closure time: ${comp.controlClosureTime.toISOString()}`,
      );

      // Perform transaction to atomically update stuck entries
      await this.dataSource.transaction(async (manager) => {
        // Double check status with lock
        const lockedComp = await manager.findOne(Competition, {
          where: { id: comp.id },
          lock: { mode: "pessimistic_write" },
        });

        if (!lockedComp || lockedComp.status !== CompetitionStatus.ACTIVE) {
          return;
        }

        const stages = await manager.find(Stage, {
          where: { competition: { id: lockedComp.id } },
          order: { stageNumber: "ASC" },
        });
        const lastStage = stages[stages.length - 1];

        // Get all entries of this competition with their timing records
        const activeEntries = await manager.find(CompetitionEntry, {
          where: { competition: { id: lockedComp.id } },
          relations: ["timingRecords", "timingRecords.stage"],
        });

        const stuckEntries = activeEntries.filter((entry) => {
          // Exclude any participant who is already in a final / finished / eliminated state
          const isFinalState = [
            ParticipantStatus.FINISHED,
            ParticipantStatus.FINISHED_PROVISIONAL,
            ParticipantStatus.DQ,
            ParticipantStatus.DNF,
            ParticipantStatus.WD,
            ParticipantStatus.NO_COMPLETED,
            ParticipantStatus.ELIMINATED_TR,
            ParticipantStatus.ELIMINATED_PP,
            ParticipantStatus.ELIMINATED_GAIT,
          ].includes(entry.status);

          if (isFinalState) {
            return false;
          }

          // Exclude participants who have already completed (crossed meta) in the last stage
          if (lastStage) {
            const hasLastStageArrival = (entry.timingRecords || []).some(
              (tr) =>
                tr.stage?.id === lastStage.id &&
                tr.recordType === "ARRIVAL" &&
                !tr.isVoid,
            );
            if (hasLastStageArrival) {
              return false;
            }
          }

          return true;
        });

        if (stuckEntries.length > 0) {
          this.logger.log(
            `[Control Closure] Updating ${stuckEntries.length} stuck competitors to NO_COMPLETED for competition ${lockedComp.name}`,
          );

          for (const entry of stuckEntries) {
            entry.status = ParticipantStatus.NO_COMPLETED;
            await manager.save(CompetitionEntry, entry);
          }
        }

        // Also mark the competition itself as COMPLETED since the control is closed
        lockedComp.status = CompetitionStatus.COMPLETED;
        await manager.save(Competition, lockedComp);

        // Emit WebSocket notification about closure
        this.realTimeGateway.emitRaceClosed(lockedComp.id);
        this.logger.log(
          `[Control Closure] WebSocket notification emitted for race ${lockedComp.id}`,
        );
      });
    }
  }
}

