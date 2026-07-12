import { Injectable, Inject, forwardRef } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { CompetitionEntry } from "../competition-entries/entities/competition-entry.entity";
import { LeaderboardEntryDto } from "./dto/leaderboard-response.dto";
import { Stage } from "../competitions/entities/stage.entity";
import {
  TimeRecordType,
  ParticipantStatus,
  CompetitionStatus,
  GaitStatus,
} from "@equuscronos/shared";
import { VetInspection } from "../vet-inspections/entities/vet-inspection.entity";
import { RealTimeGateway } from "../timing/real-time.gateway";

@Injectable()
export class LeaderboardService {
  constructor(
    @InjectRepository(CompetitionEntry)
    private readonly entryRepository: Repository<CompetitionEntry>,
    @Inject(forwardRef(() => RealTimeGateway))
    private readonly realTimeGateway: RealTimeGateway,
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
      .leftJoinAndSelect("competition.stages", "compStages")
      .leftJoinAndSelect("entry.representedTenant", "representedTenant")
      .leftJoinAndSelect("entry.currentStage", "currentStage")
      .leftJoinAndSelect("entry.timingRecords", "timing")
      .leftJoinAndSelect("timing.stage", "stage")
      .leftJoinAndMapOne(
        "timing.vetInspection",
        VetInspection,
        "vet",
        "vet.competition = competition.id AND vet.vetGateNumber = stage.stageNumber AND vet.riderDorsal = CAST(entry.bibNumber AS varchar) AND vet.isFinalDecision = true",
      )
      .leftJoinAndSelect("entry.penalties", "penalties")
      .leftJoinAndSelect("penalties.stage", "penaltyStage")
      .where("entry.competition_id = :competitionId", { competitionId })
      .getMany();

    let shouldBroadcastWS = false;

    // 2. Procesamiento Matemático por Competidor
    const leaderboard: LeaderboardEntryDto[] = [];

    for (const entry of entries) {
      const stats = this.calculateCompetitorStats(entry.timingRecords);
      const activeRecords = (entry.timingRecords || []).filter(
        (r) => !r.isVoid,
      );

      // Determinar la etapa actual calculada dinámicamente según sus registros de tiempos
      let calculatedCurrentStage = entry.currentStage?.stageNumber || 1;
      if (activeRecords.length > 0) {
        const stageNums = activeRecords.map((r) => r.stage?.stageNumber || 1);
        const maxStageNum = Math.max(...stageNums);
        if (maxStageNum > calculatedCurrentStage) {
          calculatedCurrentStage = maxStageNum;
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
        entry.status !== ParticipantStatus.WD &&
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

      // Determinar estado dinámicamente si no está descalificado o retirado
      const finalStatuses = [
        ParticipantStatus.DQ,
        ParticipantStatus.DNF,
        ParticipantStatus.WD,
        ParticipantStatus.NO_COMPLETED,
        ParticipantStatus.ELIMINATED_TR,
        ParticipantStatus.ELIMINATED_PP,
        ParticipantStatus.ELIMINATED_GAIT,
      ];
      let competitorStatus = entry.status;

      // ----------------------------------------------------
      // EVALUACIÓN DE EXPIRACIÓN DE NEUTRALIZACIÓN ("FANTASMAS")
      // ----------------------------------------------------
      const isCompetitionActive =
        entry.competition?.status === CompetitionStatus.ACTIVE;
      if (
        isCompetitionActive &&
        !finalStatuses.includes(entry.status) &&
        entry.status !== ParticipantStatus.DQ &&
        entry.status !== ParticipantStatus.FINISHED &&
        entry.status !== ParticipantStatus.FINISHED_PROVISIONAL &&
        arrivalTime &&
        calculatedCurrentStage < totalStagesCount
      ) {
        // Encontrar la etapa correspondiente
        const currentStageObj = entry.competition.stages?.find(
          (s) => s.stageNumber === calculatedCurrentStage,
        );
        const neutralizationMin = currentStageObj?.neutralizationMinutes || 60;
        const neutralizationTimeLimit = new Date(
          new Date(arrivalTime).getTime() + neutralizationMin * 60 * 1000,
        );

        const now = new Date();

        if (now.getTime() > neutralizationTimeLimit.getTime()) {
          // Si ya superó el tiempo de neutralización, verificar si tiene un VET_IN aprobado
          const hasApprovedInspection = activeRecords.some(
            (r) =>
              r.recordType === TimeRecordType.VET_IN &&
              (r.stage?.stageNumber || 1) === calculatedCurrentStage &&
              r.vetInspection &&
              r.vetInspection.heartRate <=
                (entry.competition?.maxHeartRate ?? 65) &&
              r.vetInspection.gaitStatus === GaitStatus.APPROVED,
          );

          if (!hasApprovedInspection) {
            // Expirado! Mutamos a DQ en la base de datos
            console.log(
              `[LeaderboardService] Competidor ${entry.bibNumber} superó tiempo de neutralización sin inspección aprobada. Mutando a DQ.`,
            );
            await this.entryRepository.update(
              { id: entry.id },
              { status: ParticipantStatus.DQ },
            );
            entry.status = ParticipantStatus.DQ;
            competitorStatus = ParticipantStatus.DQ;
            shouldBroadcastWS = true;
          }
        }
      }

      // Evaluar estado dinámico si no fue descalificado por expiración y no está en estado final exitoso
      if (
        !finalStatuses.includes(competitorStatus) &&
        competitorStatus !== ParticipantStatus.FINISHED &&
        competitorStatus !== ParticipantStatus.FINISHED_PROVISIONAL
      ) {
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
              const maxHR = entry.competition?.maxHeartRate ?? 65;

              if (vi.gaitStatus === GaitStatus.LAMENESS_ELIMINATED) {
                competitorStatus = ParticipantStatus.ELIMINATED_GAIT;
              } else if (vi.heartRate > maxHR) {
                // Pulso excedido: verificar si aún está a tiempo de rechequear
                const timeSinceArrival = arrivalTime
                  ? new Date().getTime() - new Date(arrivalTime).getTime()
                  : null;
                const isWithinRecovery =
                  timeSinceArrival !== null &&
                  timeSinceArrival <= 20 * 60 * 1000;

                if (isWithinRecovery) {
                  competitorStatus = ParticipantStatus.VET_CHECK; // Rechequeo permitido
                } else {
                  competitorStatus = ParticipantStatus.ELIMINATED_PP; // Fuera de recuperación
                }
              } else if (!vi.isFinalDecision) {
                competitorStatus = ParticipantStatus.VET_CHECK;
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

      const latestHeartRate = this.extractLatestHeartRate(
        entry.timingRecords,
        calculatedCurrentStage,
      );

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

      // El límite de presentación veterinaria se calcula solo si hay llegada registrada en la etapa actual
      const nextVetControlTime = arrivalTime
        ? new Date(new Date(arrivalTime).getTime() + 20 * 60 * 1000)
        : null;

      // Calcular detalle de etapas (historial)
      const activeRecordsForStages = (entry.timingRecords || []).filter(
        (r) => !r.isVoid,
      );
      const stagesMap = new Map<
        number,
        {
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
        }
      >();

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
            stageObj.motricity = rec.vetInspection.gaitStatus;
            stageObj.metabolic = rec.vetInspection.inspectionType;
          }
        }
      }

      if (startTime) {
        if (!stagesMap.has(1)) {
          stagesMap.set(1, {
            stageNumber: 1,
            distanceKm:
              entry.currentStage?.stageNumber === 1
                ? Number(entry.currentStage.distanceKm)
                : 40,
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
            netTimeMs =
              stageObj.arrivalTime.getTime() - stageObj.startTime.getTime();
            if (netTimeMs > 0 && stageObj.distanceKm > 0) {
              const hours = netTimeMs / 3600000;
              averageSpeed = parseFloat(
                (stageObj.distanceKm / hours).toFixed(3),
              );
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

      leaderboard.push({
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
      });
    }

    // 3. Algoritmo de Ranking FEU (Jerarquía estricta)
    const activeStatuses = [
      ParticipantStatus.IN_RACE,
      ParticipantStatus.RESTING,
      ParticipantStatus.VET_CHECK,
      ParticipantStatus.FINISHED,
      ParticipantStatus.FINISHED_PROVISIONAL,
    ];

    leaderboard.sort((a, b) => {
      const aIsActive = activeStatuses.includes(a.status);
      const bIsActive = activeStatuses.includes(b.status);

      if (aIsActive && !bIsActive) return -1;
      if (!aIsActive && bIsActive) return 1;

      // Calcular el score de progreso físico para cada uno (mayor es mejor)
      const aProgress = this.getProgressScore(a);
      const bProgress = this.getProgressScore(b);

      if (aProgress !== bProgress) {
        return bProgress - aProgress; // El de mayor progreso físico va primero
      }

      // Menor Tiempo Neto Acumulado (totalRaceTimeMs)
      const aTime = a.totalRaceTimeMs ?? Infinity;
      const bTime = b.totalRaceTimeMs ?? Infinity;
      return aTime - bTime;
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
    const displayFinalStatuses = [
      ParticipantStatus.DQ,
      ParticipantStatus.DNF,
      ParticipantStatus.WD,
      ParticipantStatus.NO_COMPLETED,
      ParticipantStatus.ELIMINATED_TR,
      ParticipantStatus.ELIMINATED_PP,
      ParticipantStatus.ELIMINATED_GAIT,
      ParticipantStatus.FINISHED,
      ParticipantStatus.FINISHED_PROVISIONAL,
    ];
    leaderboard.forEach((entry) => {
      if (
        !displayFinalStatuses.includes(entry.status) &&
        (entry.completedStages || 0) < entry.currentStage
      ) {
        entry.totalRaceTimeMs = null;
        entry.averageSpeed = null;
        entry.gapToLeaderMs = null;
      }
    });

    // Enviar por WebSockets si algún competidor fue movido a DQ por expiración
    if (shouldBroadcastWS) {
      try {
        this.realTimeGateway.emitLeaderboardUpdate(competitionId, leaderboard);
      } catch (err) {
        console.error(
          `[LeaderboardService] Error broadcasting leaderboard update:`,
          err,
        );
      }
    }

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

    return currentStageVetRecord
      ? currentStageVetRecord.vetInspection.heartRate
      : null;
  }

  private getProgressScore(entry: LeaderboardEntryDto): number {
    const starts = new Set<number>();
    const arrivals = new Set<number>();
    const vetIns = new Set<number>();

    for (const stage of entry.stages || []) {
      const stageNum = stage.stageNumber;
      if (stageNum === undefined || stageNum === null) continue;
      if (stage.startTime) {
        starts.add(stageNum);
      }
      if (stage.arrivalTime) {
        arrivals.add(stageNum);
      }
      if (stage.vetInTime) {
        vetIns.add(stageNum);
      }
    }

    return starts.size + arrivals.size + vetIns.size;
  }
}
