import { Injectable, NotFoundException, BadRequestException } from "@nestjs/common";
import { DataSource, EntityManager } from "typeorm";
import { TimingRecord } from "../competitions/entities/timing-record.entity";
import { CompetitionEntry } from "../competition-entries/entities/competition-entry.entity";
import { Stage } from "../competitions/entities/stage.entity";
import { VetInspection } from "../vet-inspections/entities/vet-inspection.entity";
import { Penalty } from "../competitions/entities/penalty.entity";
import { TimeCalculationService } from "./services/time-calculation.service";
import { LeaderboardService } from "../leaderboard/leaderboard.service";
import { RealTimeGateway } from "./real-time.gateway";
import { TimeRecordType, ParticipantStatus, MotricityStatus, ClinicalStatus } from "@equuscronos/shared";

@Injectable()
export class AdminContingencyService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly timeCalcService: TimeCalculationService,
    private readonly leaderboardService: LeaderboardService,
    private readonly realTimeGateway: RealTimeGateway,
  ) {}

  /**
   * Helper to recalculate departure times and evaluate disqualification rules (FEU rules check)
   */
  async recalculateAndValidateEntry(manager: EntityManager, entryId: string): Promise<void> {
    const entry = await manager.findOne(CompetitionEntry, {
      where: { id: entryId },
      relations: ["competition", "timingRecords", "timingRecords.stage", "timingRecords.vetInspection"],
    });

    if (!entry) return;

    const activeRecords = (entry.timingRecords || []).filter((r) => !r.isVoid);

    // 1. Recalculate scheduled departure times for all ARRIVAL records
    for (const record of activeRecords) {
      if (record.recordType === TimeRecordType.ARRIVAL) {
        const stage = record.stage;
        if (stage) {
          const nextDepTime = this.timeCalcService.calculateNextDepartureTime(
            new Date(record.recordedAt),
            stage,
          );
          if (nextDepTime) {
            record.scheduledDepartureTime = nextDepTime;
            await manager.save(TimingRecord, record);
          }
        }
      }
    }

    // 2. Evaluate FEU disqualification rules (heart rate limits & motricity)
    const maxHeartRate = entry.competition.maxHeartRate || 65;
    let isDisqualified = false;

    for (const record of activeRecords) {
      if (record.recordType === TimeRecordType.VET_IN && record.vetInspection) {
        const vi = record.vetInspection;
        if (vi.heartRate > maxHeartRate) {
          isDisqualified = true;
        }
        if (vi.motricity === MotricityStatus.NOT_APTO) {
          isDisqualified = true;
        }
      }
    }

    // Determine target status
    let targetStatus = entry.status;
    if (isDisqualified) {
      targetStatus = ParticipantStatus.DQ;
    } else {
      // If was disqualified previously but rules are now satisfied, restore to a valid dynamic status
      if (entry.status === ParticipantStatus.DQ) {
        const sorted = [...activeRecords].sort(
          (a, b) => new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime(),
        );
        const latestRecord = sorted.length > 0 ? sorted[0] : null;
        if (!latestRecord) {
          targetStatus = ParticipantStatus.IN_RACE;
        } else {
          switch (latestRecord.recordType) {
            case TimeRecordType.START:
              targetStatus = ParticipantStatus.IN_RACE;
              break;
            case TimeRecordType.ARRIVAL:
              targetStatus = ParticipantStatus.VET_CHECK;
              break;
            case TimeRecordType.VET_IN:
              if (latestRecord.vetInspection?.isRecheckRequired) {
                targetStatus = ParticipantStatus.VET_CHECK;
              } else {
                const totalStagesCount = await manager.count(Stage, {
                  where: { competition: { id: entry.competition.id } },
                });
                const currentStageNum = latestRecord.stage?.stageNumber || 1;
                if (currentStageNum >= totalStagesCount) {
                  targetStatus = ParticipantStatus.FINISHED;
                } else {
                  targetStatus = ParticipantStatus.RESTING;
                }
              }
              break;
            case TimeRecordType.VET_OUT:
              targetStatus = ParticipantStatus.RESTING;
              break;
            default:
              targetStatus = ParticipantStatus.IN_RACE;
          }
        }
      }
    }

    if (entry.status !== targetStatus) {
      entry.status = targetStatus;
      await manager.save(CompetitionEntry, entry);
    }
  }

  private async broadcastUpdate(competitionId: string): Promise<void> {
    try {
      const leaderboard = await this.leaderboardService.getLiveLeaderboard(competitionId);
      this.realTimeGateway.emitLeaderboardUpdate(competitionId, leaderboard);
    } catch (err) {
      console.error("[AdminContingencyService] Failed to broadcast real-time update:", err);
    }
  }

  // ==========================================
  // TIMING RECORD ACTIONS
  // ==========================================

  async updateTimingRecord(id: string, recordedAt: string): Promise<TimingRecord> {
    return await this.dataSource.transaction(async (manager: EntityManager) => {
      const record = await manager.findOne(TimingRecord, {
        where: { id },
        relations: ["entry", "entry.competition"],
      });
      if (!record) {
        throw new NotFoundException(`Registro de tiempo ${id} no encontrado.`);
      }

      record.recordedAt = new Date(recordedAt);
      const savedRecord = await manager.save(TimingRecord, record);

      await this.recalculateAndValidateEntry(manager, record.entry.id);

      // Async broadcast after transaction commits
      setTimeout(() => this.broadcastUpdate(record.entry.competition.id), 100);

      return savedRecord;
    });
  }

  async deleteTimingRecord(id: string): Promise<void> {
    await this.dataSource.transaction(async (manager: EntityManager) => {
      const record = await manager.findOne(TimingRecord, {
        where: { id },
        relations: ["entry", "entry.competition"],
      });
      if (!record) {
        throw new NotFoundException(`Registro de tiempo ${id} no encontrado.`);
      }

      const entryId = record.entry.id;
      const competitionId = record.entry.competition.id;

      await manager.remove(TimingRecord, record);
      await this.recalculateAndValidateEntry(manager, entryId);

      // Async broadcast after transaction commits
      setTimeout(() => this.broadcastUpdate(competitionId), 100);
    });
  }

  // ==========================================
  // VET INSPECTION ACTIONS
  // ==========================================

  async updateVetInspection(
    id: string,
    heartRate: number,
    motricity: MotricityStatus,
    metabolic?: ClinicalStatus,
    notes?: string,
  ): Promise<VetInspection> {
    return await this.dataSource.transaction(async (manager: EntityManager) => {
      const inspection = await manager.findOne(VetInspection, {
        where: { id },
        relations: ["timingRecord", "timingRecord.entry", "timingRecord.entry.competition"],
      });
      if (!inspection) {
        throw new NotFoundException(`Inspección veterinaria ${id} no encontrada.`);
      }

      inspection.heartRate = heartRate;
      inspection.motricity = motricity;
      if (metabolic) inspection.metabolic = metabolic;
      if (notes !== undefined) inspection.notes = notes;

      const savedInspection = await manager.save(VetInspection, inspection);

      if (inspection.timingRecord?.entry) {
        await this.recalculateAndValidateEntry(manager, inspection.timingRecord.entry.id);
        const compId = inspection.timingRecord.entry.competition.id;
        setTimeout(() => this.broadcastUpdate(compId), 100);
      }

      return savedInspection;
    });
  }

  async deleteVetInspection(id: string): Promise<void> {
    await this.dataSource.transaction(async (manager: EntityManager) => {
      const inspection = await manager.findOne(VetInspection, {
        where: { id },
        relations: ["timingRecord", "timingRecord.entry", "timingRecord.entry.competition"],
      });
      if (!inspection) {
        throw new NotFoundException(`Inspección veterinaria ${id} no encontrada.`);
      }

      const entryId = inspection.timingRecord?.entry?.id;
      const competitionId = inspection.timingRecord?.entry?.competition?.id;

      await manager.remove(VetInspection, inspection);

      if (entryId && competitionId) {
        await this.recalculateAndValidateEntry(manager, entryId);
        setTimeout(() => this.broadcastUpdate(competitionId), 100);
      }
    });
  }

  // ==========================================
  // PENALTY ACTIONS
  // ==========================================

  async createPenalty(
    entryId: string,
    stageId: string,
    timePenaltySeconds: number,
    reason: string,
  ): Promise<Penalty> {
    return await this.dataSource.transaction(async (manager: EntityManager) => {
      const entry = await manager.findOne(CompetitionEntry, {
        where: { id: entryId },
        relations: ["competition", "tenant"],
      });
      if (!entry) {
        throw new NotFoundException(`Binomio ${entryId} no encontrado.`);
      }

      const stage = await manager.findOne(Stage, { where: { id: stageId } });
      if (!stage) {
        throw new NotFoundException(`Etapa ${stageId} no encontrada.`);
      }

      const penalty = manager.create(Penalty, {
        tenant: entry.tenant,
        entry,
        stage,
        timePenaltySeconds,
        reason,
      });

      const savedPenalty = await manager.save(Penalty, penalty);

      await this.recalculateAndValidateEntry(manager, entryId);
      setTimeout(() => this.broadcastUpdate(entry.competition.id), 100);

      return savedPenalty;
    });
  }

  async updatePenalty(id: string, timePenaltySeconds: number, reason: string): Promise<Penalty> {
    return await this.dataSource.transaction(async (manager: EntityManager) => {
      const penalty = await manager.findOne(Penalty, {
        where: { id },
        relations: ["entry", "entry.competition"],
      });
      if (!penalty) {
        throw new NotFoundException(`Penalización ${id} no encontrada.`);
      }

      penalty.timePenaltySeconds = timePenaltySeconds;
      penalty.reason = reason;

      const savedPenalty = await manager.save(Penalty, penalty);

      await this.recalculateAndValidateEntry(manager, penalty.entry.id);
      setTimeout(() => this.broadcastUpdate(penalty.entry.competition.id), 100);

      return savedPenalty;
    });
  }

  async deletePenalty(id: string): Promise<void> {
    await this.dataSource.transaction(async (manager: EntityManager) => {
      const penalty = await manager.findOne(Penalty, {
        where: { id },
        relations: ["entry", "entry.competition"],
      });
      if (!penalty) {
        throw new NotFoundException(`Penalización ${id} no encontrada.`);
      }

      const entryId = penalty.entry.id;
      const competitionId = penalty.entry.competition.id;

      await manager.remove(Penalty, penalty);

      await this.recalculateAndValidateEntry(manager, entryId);
      setTimeout(() => this.broadcastUpdate(competitionId), 100);
    });
  }
}
