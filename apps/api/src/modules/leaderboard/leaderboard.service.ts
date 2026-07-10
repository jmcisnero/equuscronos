import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { CompetitionEntry } from "../competition-entries/entities/competition-entry.entity";
import { LeaderboardEntryDto } from "./dto/leaderboard-response.dto";
import { Stage } from "../competitions/entities/stage.entity";
import {
  TimeRecordType,
  ParticipantStatus,
  CompetitionStatus,
  MotricityStatus,
} from "@equuscronos/shared";

@Injectable()
export class LeaderboardService {
  constructor(
    @InjectRepository(CompetitionEntry)
    private readonly entryRepository: Repository<CompetitionEntry>,
  ) {}

  async getLiveLeaderboard(
    competitionId: string,
  ): Promise<LeaderboardEntryDto[]> {
    // Encontrar la cantidad total de etapas de esta competencia para determinar el estado FINISHED
    const totalStagesCount = await this.entryRepository.manager.count(Stage, {
      where: { competition: { id: competitionId } },
    });

    const entries = await this.entryRepository
      .createQueryBuilder("entry")
      .innerJoinAndSelect("entry.rider", "rider")
      .innerJoinAndSelect("entry.horse", "horse")
      .innerJoinAndSelect("entry.competition", "competition")
      .leftJoinAndSelect("entry.representedTenant", "representedTenant")
      .leftJoinAndSelect("entry.currentStage", "currentStage")
      .leftJoinAndSelect("entry.timingRecords", "timing")
      .leftJoinAndSelect("timing.stage", "stage")
      .leftJoinAndSelect("timing.vetInspection", "vet") // <-- EXTRAEMOS EL PULSO CLÍNICO
      .leftJoinAndSelect("entry.penalties", "penalties")
      .leftJoinAndSelect("penalties.stage", "penaltyStage")
      .where("entry.competition_id = :competitionId", { competitionId })
      .getMany();

    // 2. Procesamiento Matemático por Competidor
    const leaderboard: LeaderboardEntryDto[] = entries.map((entry) => {
      const stats = this.calculateCompetitorStats(entry.timingRecords);
      const activeRecords = (entry.timingRecords || []).filter((r) => !r.isVoid);

      // Determinar la etapa actual calculada dinámicamente según sus registros de tiempos
      let calculatedCurrentStage = entry.currentStage?.stageNumber || 1;
      if (activeRecords.length > 0) {
        const stageNums = activeRecords.map((r) => r.stage?.stageNumber || 1);
        const maxStageNum = Math.max(...stageNums);
        if (maxStageNum > calculatedCurrentStage) {
          calculatedCurrentStage = maxStageNum;
        }
      }

      // Determinar estado dinámicamente si no está descalificado o retirado
      const finalStatuses = [
        ParticipantStatus.DQ,
        ParticipantStatus.DNF,
        ParticipantStatus.WD,
      ];
      let competitorStatus = entry.status;
      if (!finalStatuses.includes(competitorStatus)) {
        if (activeRecords.length > 0) {
          const latestStageRecords = activeRecords.filter(
            (r) => (r.stage?.stageNumber || 1) === calculatedCurrentStage,
          );

          const hasStart = latestStageRecords.some(
            (r) => r.recordType === TimeRecordType.START,
          );
          const hasArrival = latestStageRecords.some(
            (r) => r.recordType === TimeRecordType.ARRIVAL,
          );
          const hasVetIn = latestStageRecords.some(
            (r) => r.recordType === TimeRecordType.VET_IN,
          );

          if (hasStart && !hasArrival) {
            competitorStatus = ParticipantStatus.IN_RACE;
          } else if (hasArrival && !hasVetIn) {
            competitorStatus = ParticipantStatus.VET_CHECK;
          } else if (hasVetIn) {
            const vetInRecord = latestStageRecords
              .filter((r) => r.recordType === TimeRecordType.VET_IN)
              .sort(
                (a, b) =>
                  new Date(b.recordedAt).getTime() -
                  new Date(a.recordedAt).getTime(),
              )[0];

            if (vetInRecord && vetInRecord.vetInspection) {
              const vi = vetInRecord.vetInspection;
              if (vi.isRecheckRequired) {
                competitorStatus = ParticipantStatus.VET_CHECK;
              } else if (vi.motricity === MotricityStatus.NOT_APTO) {
                competitorStatus = ParticipantStatus.DQ;
              } else {
                if (calculatedCurrentStage >= totalStagesCount) {
                  competitorStatus = ParticipantStatus.FINISHED;
                } else {
                  competitorStatus = ParticipantStatus.RESTING;
                }
              }
            } else {
              competitorStatus = ParticipantStatus.VET_CHECK;
            }
          }
        }
      }

      const latestHeartRate = this.extractLatestHeartRate(entry.timingRecords, calculatedCurrentStage);

      // Extraemos la última hora de llegada registrada
      const lastArrival = activeRecords
        .filter((r) => r.recordType === TimeRecordType.ARRIVAL)
        .sort(
          (a, b) =>
            new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime(),
        )[0];
      const lastArrivalTime = lastArrival
        ? new Date(lastArrival.recordedAt)
        : null;

      // Extraemos la hora de próxima largada calculada previamente.
      // Solo la enviamos si existe y si el caballo no ha largado la etapa siguiente aún.
      let nextStageDepartureTime = null;
      if (lastArrival && lastArrival.scheduledDepartureTime) {
        // Verificamos si ya hay un START posterior a esta llegada
        const hasStartedNextStage = activeRecords.some(
          (r) =>
            r.recordType === TimeRecordType.START &&
            new Date(r.recordedAt).getTime() >
              new Date(lastArrival.recordedAt).getTime(),
        );
        if (!hasStartedNextStage) {
          nextStageDepartureTime = new Date(lastArrival.scheduledDepartureTime);
        }
      }

      // Extraemos la hora de largada, llegada e ingreso a vet gate de la etapa actual o más reciente
      let startTime = null;
      let arrivalTime = null;
      let vetInTime = null;
      if (activeRecords.length > 0) {
        const latestStageRecords = activeRecords.filter(
          (r) => (r.stage?.stageNumber || 1) === calculatedCurrentStage,
        );

        const startRecord = latestStageRecords
          .filter((r) => r.recordType === TimeRecordType.START)
          .sort(
            (a, b) =>
              new Date(a.recordedAt).getTime() -
              new Date(b.recordedAt).getTime(),
          )[0];
        if (startRecord) {
          startTime = new Date(startRecord.recordedAt);
        }

        const arrivalRecord = latestStageRecords
          .filter((r) => r.recordType === TimeRecordType.ARRIVAL)
          .sort(
            (a, b) =>
              new Date(a.recordedAt).getTime() -
              new Date(b.recordedAt).getTime(),
          )[0];
        if (arrivalRecord) {
          arrivalTime = new Date(arrivalRecord.recordedAt);
        }

        const vetInRecord = latestStageRecords
          .filter((r) => r.recordType === TimeRecordType.VET_IN)
          .sort(
            (a, b) =>
              new Date(a.recordedAt).getTime() -
              new Date(b.recordedAt).getTime(),
          )[0];
        if (vetInRecord) {
          vetInTime = new Date(vetInRecord.recordedAt);
        }
      }

      // Fallback a la hora de largada de la competencia para la Etapa 1 si no hay registro individual de START
      if (
        !startTime &&
        competitorStatus !== ParticipantStatus.WD &&
        entry.competition &&
        (entry.competition.status === CompetitionStatus.ACTIVE ||
          entry.competition.status === CompetitionStatus.COMPLETED ||
          entry.competition.status === CompetitionStatus.OFFICIAL)
      ) {
        if (calculatedCurrentStage === 1) {
          const compDateStr =
            typeof entry.competition.competitionDate === "string"
              ? entry.competition.competitionDate.substring(0, 10)
              : entry.competition.competitionDate
                  .toISOString()
                  .substring(0, 10);
          startTime = new Date(`${compDateStr}T${entry.competition.startTime}`);
        }
      }

      // El límite de presentación veterinaria se calcula solo si hay llegada registrada en la etapa actual
      const nextVetControlTime = arrivalTime
        ? new Date(new Date(arrivalTime).getTime() + 20 * 60 * 1000)
        : null;

      // Calcular detalle de etapas (historial)
      const activeRecordsForStages = (entry.timingRecords || []).filter((r) => !r.isVoid);
      const stagesMap = new Map<number, {
        stageNumber: number;
        distanceKm: number;
        stageId?: string;
        startTime?: Date;
        startTimeRecordId?: string;
        arrivalTime?: Date;
        arrivalTimeRecordId?: string;
        vetInTime?: Date;
        vetInTimeRecordId?: string;
        vetInspectionId?: string;
        motricity?: string;
        metabolic?: string;
        heartRate?: number;
      }>();

      for (const rec of activeRecordsForStages) {
        if (!rec.stage) continue;
        const sNum = rec.stage.stageNumber;
        if (!stagesMap.has(sNum)) {
          stagesMap.set(sNum, {
            stageNumber: sNum,
            distanceKm: Number(rec.stage.distanceKm),
            stageId: rec.stage.id,
          });
        }
        const stageObj = stagesMap.get(sNum)!;
        if (rec.recordType === TimeRecordType.START) {
          stageObj.startTime = new Date(rec.recordedAt);
          stageObj.startTimeRecordId = rec.id;
        } else if (rec.recordType === TimeRecordType.ARRIVAL) {
          stageObj.arrivalTime = new Date(rec.recordedAt);
          stageObj.arrivalTimeRecordId = rec.id;
        } else if (rec.recordType === TimeRecordType.VET_IN) {
          stageObj.vetInTime = new Date(rec.recordedAt);
          stageObj.vetInTimeRecordId = rec.id;
          if (rec.vetInspection) {
            stageObj.vetInspectionId = rec.vetInspection.id;
            stageObj.heartRate = rec.vetInspection.heartRate;
            stageObj.motricity = rec.vetInspection.motricity;
            stageObj.metabolic = rec.vetInspection.metabolic;
          }
        }
      }

      if (startTime) {
        if (!stagesMap.has(1)) {
          stagesMap.set(1, {
            stageNumber: 1,
            distanceKm: entry.currentStage?.stageNumber === 1 ? Number(entry.currentStage.distanceKm) : 40,
            startTime: startTime,
          });
        } else {
          const stage1 = stagesMap.get(1)!;
          if (!stage1.startTime) {
            stage1.startTime = startTime;
          }
        }
      }

      const stageHistory = Array.from(stagesMap.values())
        .sort((a, b) => a.stageNumber - b.stageNumber)
        .map((stageObj) => {
          let netTimeMs = undefined;
          let averageSpeed = undefined;
          if (stageObj.startTime && stageObj.arrivalTime) {
            netTimeMs = stageObj.arrivalTime.getTime() - stageObj.startTime.getTime();
            if (netTimeMs > 0 && stageObj.distanceKm > 0) {
              const hours = netTimeMs / 3600000;
              averageSpeed = parseFloat((stageObj.distanceKm / hours).toFixed(3));
            }
          }
          return {
            stageNumber: stageObj.stageNumber,
            distanceKm: stageObj.distanceKm,
            stageId: stageObj.stageId,
            startTime: stageObj.startTime,
            startTimeRecordId: stageObj.startTimeRecordId,
            arrivalTime: stageObj.arrivalTime,
            arrivalTimeRecordId: stageObj.arrivalTimeRecordId,
            vetInTime: stageObj.vetInTime,
            vetInTimeRecordId: stageObj.vetInTimeRecordId,
            vetInspectionId: stageObj.vetInspectionId,
            heartRate: stageObj.heartRate,
            motricity: stageObj.motricity,
            metabolic: stageObj.metabolic,
            netTimeMs,
            averageSpeed,
          };
        });

      return {
        entryId: entry.id,
        bibNumber: entry.bibNumber,
        riderName: entry.rider.name,
        horseName: entry.horse.name,
        status: competitorStatus,
        currentStage: calculatedCurrentStage,
        lastArrivalTime: lastArrivalTime,
        nextVetControlTime: nextVetControlTime,
        totalRaceTimeMs: stats.totalTimeMs,
        averageSpeed: stats.averageSpeed,
        heartRate: latestHeartRate,
        rank: 0,
        gapToLeaderMs: 0,
        nextStageDepartureTime: nextStageDepartureTime,
        startTime: startTime,
        arrivalTime: arrivalTime,
        vetInTime: vetInTime,
        completedStages: stats.completedStages,
        representedTenant: entry.representedTenant
          ? {
              id: entry.representedTenant.id,
              name: entry.representedTenant.name,
              location: entry.representedTenant.location,
              jerseyImageUrl: entry.representedTenant.jerseyImageUrl,
            }
          : null,
        stages: stageHistory,
        penalties: (entry.penalties || []).map((p) => ({
          id: p.id,
          stageNumber: p.stage?.stageNumber || 1,
          stageId: p.stage?.id,
          timePenaltySeconds: p.timePenaltySeconds,
          reason: p.reason,
        })),
      };
    });

    // 3. Algoritmo de Ranking FEU (Ordena primero por estado activo, luego por cantidad de etapas completadas de forma descendente, y luego por menor tiempo neto acumulado)
    const activeStatuses = [
      ParticipantStatus.IN_RACE,
      ParticipantStatus.RESTING,
      ParticipantStatus.FINISHED,
      ParticipantStatus.VET_CHECK,
    ];

    leaderboard.sort((a, b) => {
      const aIsActive = activeStatuses.includes(a.status);
      const bIsActive = activeStatuses.includes(b.status);

      if (aIsActive && !bIsActive) return -1;
      if (!aIsActive && bIsActive) return 1;

      const aCompleted = a.completedStages || 0;
      const bCompleted = b.completedStages || 0;
      if (aCompleted !== bCompleted) {
        return bCompleted - aCompleted; // El que tenga más etapas completadas va primero
      }

      return a.totalRaceTimeMs - b.totalRaceTimeMs; // A igualdad de etapas, menor tiempo neto va primero
    });

    // 4. Asignación de Gaps (Diferencias de tiempo) y Ranking (solo para activos)
    const leaderTime = leaderboard[0]?.totalRaceTimeMs || 0;
    let nextRank = 1;
    leaderboard.forEach((entry) => {
      const isActive = activeStatuses.includes(entry.status);
      entry.rank = isActive ? nextRank++ : null;
      entry.gapToLeaderMs =
        entry.totalRaceTimeMs > 0 ? entry.totalRaceTimeMs - leaderTime : 0;
    });

    // 5. Ajustar campos de visualización para etapas activas no finalizadas
    const finalStatuses = [
      ParticipantStatus.DQ,
      ParticipantStatus.DNF,
      ParticipantStatus.WD,
    ];
    leaderboard.forEach((entry) => {
      if (
        !finalStatuses.includes(entry.status) &&
        (entry.completedStages || 0) < entry.currentStage
      ) {
        entry.totalRaceTimeMs = null;
        entry.averageSpeed = null;
        entry.gapToLeaderMs = null;
      }
    });

    return leaderboard;
  }

  /**
   * Calcula el Tiempo Neto y la Velocidad Promedio de este competidor.
   */
  private calculateCompetitorStats(records: any[]): {
    totalTimeMs: number;
    averageSpeed: number;
    completedStages: number;
  } {
    if (!records || records.length === 0)
      return { totalTimeMs: 0, averageSpeed: 0, completedStages: 0 };

    let totalMs = 0;
    let completedDistanceKm = 0;
    let completedStages = 0;

    // Agrupar por etapa para emparejar START con ARRIVAL, ignorando registros anulados (isVoid)
    const activeRecords = (records || []).filter((r) => !r.isVoid);
    const recordsByStage = activeRecords.reduce((acc, curr) => {
      if (!curr.stage) return acc;
      const stageId = curr.stage.id;
      if (!acc[stageId])
        acc[stageId] = { distance: Number(curr.stage.distanceKm) };
      acc[stageId][curr.recordType] = curr.recordedAt;
      return acc;
    }, {});

    for (const stageId in recordsByStage) {
      const stage = recordsByStage[stageId];
      if (stage[TimeRecordType.START] && stage[TimeRecordType.ARRIVAL]) {
        const start = new Date(stage[TimeRecordType.START]).getTime();
        const arrival = new Date(stage[TimeRecordType.ARRIVAL]).getTime();

        totalMs += arrival - start;
        completedDistanceKm += stage.distance; // Solo sumamos distancia de etapas terminadas
        completedStages++;
      }
    }

    // Fórmula: (Distancia en Km / Tiempo en Horas) = Km/h
    let averageSpeed = 0;
    if (totalMs > 0 && completedDistanceKm > 0) {
      const totalHours = totalMs / 3600000;
      averageSpeed = parseFloat((completedDistanceKm / totalHours).toFixed(3)); // 3 decimales FEU
    }

    return { totalTimeMs: totalMs, averageSpeed, completedStages };
  }

  /**
   * Busca el último registro VET_IN válido de la etapa actual y extrae el pulso de la clínica.
   */
  private extractLatestHeartRate(
    records: any[],
    currentStageNumber: number,
  ): number | null {
    if (!records) return null;

    // Ordenar de más reciente a más antiguo
    const sortedRecords = [...records].sort(
      (a, b) =>
        new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime(),
    );

    // Buscar el VET_IN de la etapa actual (currentStageNumber) que tenga una inspección veterinaria asociada y no esté anulado
    const currentStageVetRecord = sortedRecords.find(
      (r) =>
        !r.isVoid &&
        r.recordType === TimeRecordType.VET_IN &&
        (r.stage?.stageNumber || 1) === currentStageNumber &&
        r.vetInspection != null,
    );

    return currentStageVetRecord ? currentStageVetRecord.vetInspection.heartRate : null;
  }


}
