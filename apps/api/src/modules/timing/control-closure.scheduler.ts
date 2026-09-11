import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { DataSource, LessThanOrEqual } from "typeorm";
import { Competition } from "../competitions/entities/competition.entity";
import { Stage } from "../competitions/entities/stage.entity";
import { CompetitionEntry } from "../competition-entries/entities/competition-entry.entity";
import { VetInspection } from "../vet-inspections/entities/vet-inspection.entity";
import { TimingRecord } from "../competitions/entities/timing-record.entity";
import {
  CompetitionStatus,
  ParticipantStatus,
  TimeRecordType,
  EliminationCode,
  GaitStatus,
} from "@equuscronos/shared";
import { RealTimeGateway } from "./real-time.gateway";
import { LeaderboardService } from "../leaderboard/leaderboard.service";

@Injectable()
export class ControlClosureScheduler {
  private readonly logger = new Logger(ControlClosureScheduler.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly realTimeGateway: RealTimeGateway,
    private readonly leaderboardService: LeaderboardService,
  ) {}

  @Cron(CronExpression.EVERY_30_SECONDS)
  async checkControlClosures() {
    const now = new Date();

    // 1. Descalificación por Vencimiento de Neutralización (Art. 28, 30 y 31 FEU)
    await this.checkNeutralizationTimeouts(now);

    // 2. Cierre general de control de competencias activas
    const activeCompetitions = await this.dataSource
      .getRepository(Competition)
      .find({
        where: {
          status: CompetitionStatus.ACTIVE,
        },
      });

    if (activeCompetitions.length === 0) {
      return;
    }

    const finalStatuses = [
      ParticipantStatus.FINISHED,
      ParticipantStatus.FINISHED_PROVISIONAL,
      ParticipantStatus.DQ,
      ParticipantStatus.DNF,
      ParticipantStatus.WD,
      ParticipantStatus.NO_COMPLETED,
      ParticipantStatus.ELIMINATED_TR,
      ParticipantStatus.ELIMINATED_PP,
      ParticipantStatus.ELIMINATED_GAIT,
    ];

    for (const comp of activeCompetitions) {
      // Perform transaction to atomically update stuck entries and transition competition status
      await this.dataSource.transaction(async (manager) => {
        // Double check status with lock
        const lockedComp = await manager.findOne(Competition, {
          where: { id: comp.id },
          lock: { mode: "pessimistic_write" },
        });

        if (!lockedComp || lockedComp.status !== CompetitionStatus.ACTIVE) {
          return;
        }

        const isControlExpired =
          lockedComp.controlClosureTime &&
          now >= new Date(lockedComp.controlClosureTime);

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
          if (finalStatuses.includes(entry.status)) {
            return false;
          }

          // Exclude participants who have already completed (crossed meta) in the last stage
          if (lastStage) {
            const hasLastStageArrival = (entry.timingRecords || []).some(
              (tr) =>
                tr.stage?.id === lastStage.id &&
                tr.recordType === TimeRecordType.ARRIVAL &&
                !tr.isVoid,
            );
            if (hasLastStageArrival) {
              return false;
            }
          }

          return true;
        });

        // If control closure time has expired, fail stuck entries to NO_COMPLETED
        if (isControlExpired && stuckEntries.length > 0) {
          this.logger.log(
            `[Control Closure] Updating ${stuckEntries.length} stuck competitors to NO_COMPLETED for competition ${lockedComp.name}`,
          );

          for (const entry of stuckEntries) {
            entry.status = ParticipantStatus.NO_COMPLETED;
            await manager.save(CompetitionEntry, entry);
          }
        }

        // Re-evaluate if all entries are terminal after updating stuck entries
        const allEntriesTerminal =
          activeEntries.length > 0 &&
          activeEntries.every((entry) => finalStatuses.includes(entry.status));

        // Mark competition as COMPLETED if control time expired OR all participants are terminal
        if (isControlExpired || allEntriesTerminal) {
          lockedComp.status = CompetitionStatus.COMPLETED;
          await manager.save(Competition, lockedComp);

          // Emit WebSocket notification about closure
          this.realTimeGateway.emitRaceClosed(lockedComp.id);
          this.logger.log(
            `[Control Closure] Competition ${lockedComp.name} (${lockedComp.id}) marked as COMPLETED. Reason: ${
              allEntriesTerminal
                ? "All competitors reached terminal state"
                : "Control closure time expired"
            }`,
          );
        }
      });
    }
  }

  /**
   * Evalúa y descalifica automáticamente (ELIMINATED_TR) a los binomios que excedan el plazo
   * de neutralización de una etapa sin haber completado o aprobado el chequeo veterinario.
   */
  private async checkNeutralizationTimeouts(now: Date): Promise<void> {
    const activeCompetitions = await this.dataSource
      .getRepository(Competition)
      .find({
        where: { status: CompetitionStatus.ACTIVE },
        relations: ["competitionType"],
      });

    if (activeCompetitions.length === 0) return;

    const finalStatuses = [
      ParticipantStatus.FINISHED,
      ParticipantStatus.FINISHED_PROVISIONAL,
      ParticipantStatus.DQ,
      ParticipantStatus.DNF,
      ParticipantStatus.WD,
      ParticipantStatus.NO_COMPLETED,
      ParticipantStatus.ELIMINATED_TR,
      ParticipantStatus.ELIMINATED_PP,
      ParticipantStatus.ELIMINATED_GAIT,
    ];

    for (const comp of activeCompetitions) {
      await this.dataSource.transaction(async (manager) => {
        const stages = await manager.find(Stage, {
          where: { competition: { id: comp.id } },
          order: { stageNumber: "ASC" },
        });

        if (stages.length === 0) return;
        const lastStage = stages[stages.length - 1];

        const entries = await manager.find(CompetitionEntry, {
          where: { competition: { id: comp.id } },
          relations: ["timingRecords", "timingRecords.stage", "horse", "rider"],
        });

        const vetInspections = await manager.find(VetInspection, {
          where: { competition: { id: comp.id } },
          order: { createdAt: "ASC" },
        });

        const effectiveMaxHr =
          comp.maxHeartRate ??
          (comp.competitionType as any)?.defaultRules?.max_heart_rate ??
          65;

        let updatedAny = false;

        for (const entry of entries) {
          if (finalStatuses.includes(entry.status)) {
            continue; // Idempotencia: omitir binomios con estado terminal
          }

          const activeRecords = (entry.timingRecords || []).filter(
            (tr) => !tr.isVoid,
          );

          for (const stage of stages) {
            // Ignorar la última etapa (meta final) donde rige la tolerancia de cierre de control y no la neutralización
            if (stage.id === lastStage.id) continue;

            const neutralizationMins =
              stage.neutralizationMinutes ??
              (comp.competitionType as any)?.defaultRules?.neutralization_minutes ??
              60;

            if (neutralizationMins <= 0) continue;

            const arrivalRecord = activeRecords.find(
              (r) =>
                r.recordType === TimeRecordType.ARRIVAL &&
                r.stage?.id === stage.id,
            );

            if (!arrivalRecord) continue;

            const arrivalTime = new Date(arrivalRecord.recordedAt).getTime();
            const neutralizationDeadline =
              arrivalTime + neutralizationMins * 60 * 1000;

            if (now.getTime() > neutralizationDeadline) {
              const stageInspections = vetInspections.filter(
                (vi) =>
                  vi.vetGateNumber === stage.stageNumber &&
                  vi.riderDorsal === String(entry.bibNumber),
              );

              const vetInRecord = activeRecords.find(
                (r) =>
                  r.recordType === TimeRecordType.VET_IN &&
                  r.stage?.id === stage.id,
              );

              const missingVetIn = !vetInRecord;

              let hasApprovedInspection = false;
              if (stageInspections.length > 0) {
                const lastFinalInsp =
                  stageInspections.filter((vi) => vi.isFinalDecision).pop() ||
                  stageInspections[stageInspections.length - 1];

                if (
                  lastFinalInsp.isFinalDecision &&
                  !lastFinalInsp.requiresRecheck &&
                  !lastFinalInsp.isRecheckRequired &&
                  lastFinalInsp.gaitStatus === GaitStatus.APPROVED &&
                  lastFinalInsp.heartRate <= effectiveMaxHr
                ) {
                  hasApprovedInspection = true;
                }
              }

              if (
                entry.status === ParticipantStatus.RESTING &&
                arrivalRecord?.scheduledDepartureTime
              ) {
                hasApprovedInspection = true;
              }

              if (missingVetIn || !hasApprovedInspection) {
                const reason = "Ex. T. Rec. - No presentado en neutralización";

                entry.status = ParticipantStatus.ELIMINATED_TR;
                await manager.save(CompetitionEntry, entry);

                if (vetInRecord) {
                  vetInRecord.isApproved = false;
                  vetInRecord.eliminationType = EliminationCode.TIME;
                  vetInRecord.eliminationReason = reason;
                  await manager.save(TimingRecord, vetInRecord);
                }

                this.logger.log(
                  `[Control Closure] Competidor #${entry.bibNumber} descalificado a ELIMINATED_TR por expirar tiempo de neutralización en Etapa ${stage.stageNumber}.`,
                );

                updatedAny = true;
                break;
              }
            }
          }
        }

        if (updatedAny) {
          try {
            const leaderboard =
              await this.leaderboardService.getLiveLeaderboard(comp.id);
            this.realTimeGateway.emitLeaderboardUpdate(comp.id, leaderboard);
          } catch (err: any) {
            this.logger.error(
              `[Control Closure] Error emitiendo leaderboard tras descalificaciones por neutralización: ${err.message}`,
            );
          }
        }
      });
    }
  }
}
