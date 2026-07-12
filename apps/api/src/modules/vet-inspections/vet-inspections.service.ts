import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, DataSource, EntityManager } from "typeorm";
import { VetInspection } from "./entities/vet-inspection.entity";
import { TimingRecord } from "../competitions/entities/timing-record.entity";
import { CreateVetInspectionDto } from "./dto/create-vet-inspection.dto";
import {
  TimeRecordType,
  ParticipantStatus,
  EliminationCode,
  GaitStatus,
  InspectionType,
} from "@equuscronos/shared";
import { CompetitionEntry } from "../competition-entries/entities/competition-entry.entity";
import { Stage } from "../competitions/entities/stage.entity";
import { TimingService } from "../timing/timing.service";
import { LeaderboardService } from "../leaderboard/leaderboard.service";
import { RealTimeGateway } from "../timing/real-time.gateway";

@Injectable()
export class VetInspectionsService {
  constructor(
    @InjectRepository(VetInspection)
    private readonly vetRepo: Repository<VetInspection>,
    @InjectRepository(TimingRecord)
    private readonly timingRepo: Repository<TimingRecord>,
    private readonly dataSource: DataSource,
    private readonly timingService: TimingService,
    private readonly leaderboardService: LeaderboardService,
    private readonly realTimeGateway: RealTimeGateway,
  ) {}

  async create(dto: CreateVetInspectionDto): Promise<VetInspection> {
    const bibNum = parseInt(dto.riderDorsal, 10);
    if (isNaN(bibNum)) {
      throw new BadRequestException(
        "El dorsal del jinete debe ser un número válido.",
      );
    }

    return await this.dataSource.transaction(async (manager: EntityManager) => {
      // 1. Búsqueda con Bloqueo Pesimista del binomio
      const entryToLock = await manager.findOne(CompetitionEntry, {
        where: {
          competition: { id: dto.competitionId },
          bibNumber: bibNum,
        },
      });

      if (!entryToLock) {
        throw new NotFoundException(
          `Binomio con dorsal ${dto.riderDorsal} no encontrado en la competencia activa.`,
        );
      }

      const lockedEntry = await manager.findOne(CompetitionEntry, {
        where: { id: entryToLock.id },
        lock: { mode: "pessimistic_write" },
      });

      const entry = await manager.findOne(CompetitionEntry, {
        where: { id: lockedEntry.id },
        relations: [
          "competition",
          "competition.tenant",
          "horse",
          "rider",
          "tenant",
          "currentStage",
        ],
      });

      if (!entry) {
        throw new NotFoundException("Inscripción no encontrada.");
      }

      // 2. Seguridad: Bloquear si ya está eliminado o fuera de carrera
      const invalidStatuses = [
        ParticipantStatus.DQ,
        ParticipantStatus.DNF,
        ParticipantStatus.WD,
        ParticipantStatus.ELIMINATED_TR,
        ParticipantStatus.ELIMINATED_PP,
        ParticipantStatus.ELIMINATED_GAIT,
      ];
      if (invalidStatuses.includes(entry.status)) {
        throw new ForbiddenException(
          `Acción rechazada: El binomio con dorsal ${entry.bibNumber} está fuera de competencia (${entry.status}).`,
        );
      }

      // 3. Buscar etapa y neutralización correspondiente
      const stage = await manager.findOne(Stage, {
        where: {
          competition: { id: dto.competitionId },
          stageNumber: dto.vetGateNumber,
        },
      });

      if (!stage) {
        throw new NotFoundException(
          `No se encontró la etapa número ${dto.vetGateNumber} en esta competencia.`,
        );
      }

      // 4. Calcular diferencia de tiempo de recuperación (Tolerancia)
      const arrivalTime = new Date(dto.arrivalTime);
      const vetInTime = new Date(dto.vetInTime);
      const diffMs = vetInTime.getTime() - arrivalTime.getTime();

      if (isNaN(diffMs) || diffMs < 0) {
        throw new BadRequestException(
          "Las fechas de llegada o ingreso al área veterinaria son inválidas.",
        );
      }

      const recoveryMinutes = diffMs / (1000 * 60);
      const isRecoveryTimeExceeded = diffMs > 20 * 60 * 1000;

      // 5. Garantizar registros de tiempos (TimingRecords) de contingencia
      let arrivalRecord = await manager.findOne(TimingRecord, {
        where: {
          entry: { id: entry.id },
          stage: { id: stage.id },
          recordType: TimeRecordType.ARRIVAL,
          isVoid: false,
        },
      });

      if (!arrivalRecord) {
        arrivalRecord = manager.create(TimingRecord, {
          tenant: entry.tenant,
          entry,
          stage,
          recordType: TimeRecordType.ARRIVAL,
          recordedAt: arrivalTime,
          isApproved: true,
        });
        arrivalRecord = await manager.save(TimingRecord, arrivalRecord);
      }

      let vetInRecords = await manager.find(TimingRecord, {
        where: {
          entry: { id: entry.id },
          stage: { id: stage.id },
          recordType: TimeRecordType.VET_IN,
          isVoid: false,
        },
        order: { recordedAt: "DESC" },
      });

      let vetInRecord = vetInRecords[0];

      if (!vetInRecord) {
        vetInRecord = manager.create(TimingRecord, {
          tenant: entry.tenant,
          entry,
          stage,
          recordType: TimeRecordType.VET_IN,
          recordedAt: vetInTime,
          isApproved: true,
        });
        vetInRecord = await manager.save(TimingRecord, vetInRecord);
      }

      // Buscar inspecciones previas de la misma etapa
      const previousInspections = await manager.find(VetInspection, {
        where: {
          competition: { id: dto.competitionId },
          vetGateNumber: dto.vetGateNumber,
          riderDorsal: dto.riderDorsal,
        },
      });

      let targetStatus = ParticipantStatus.RESTING;
      let shouldDisqualify = false;
      let eliminationCode: EliminationCode = null;
      let reason = "";
      let isFinalDecision = true;

      // Evaluar Reglas FEU:
      if (isRecoveryTimeExceeded) {
        // Regla 1: Tiempo de recuperación excedido (20 min) -> ELIMINATED_TR
        targetStatus = ParticipantStatus.ELIMINATED_TR;
        shouldDisqualify = true;
        eliminationCode = EliminationCode.TIME;
        reason = `Fuera de tiempo de recuperación: ${Math.round(recoveryMinutes)} minutos (Límite: 20 min).`;
      } else if (dto.gaitStatus === GaitStatus.LAMENESS_ELIMINATED) {
        // Regla 2: Cojera -> ELIMINATED_GAIT
        targetStatus = ParticipantStatus.ELIMINATED_GAIT;
        shouldDisqualify = true;
        eliminationCode = EliminationCode.GAIT;
        reason = "Claudicación / Cojera detectada.";
      } else if (dto.heartRate > 65) {
        // Regla 3: Pulso alto (> 65 ppm)
        // Si ya tiene un intento previo o el tipo de inspección es RE_INSPECTION_REQUESTED,
        // o si simplemente expira el tiempo. Pero en la mesa de control de contingencia,
        // si ya tiene registros previos fallidos, descalificar.
        const hadPriorPulseFailures = previousInspections.some(
          (ins) => ins.heartRate > 65 && ins.isFinalDecision === false,
        );

        if (
          hadPriorPulseFailures ||
          dto.inspectionType === InspectionType.RE_INSPECTION_REQUESTED
        ) {
          // Ya es el segundo intento fallido -> ELIMINATED_PP
          targetStatus = ParticipantStatus.ELIMINATED_PP;
          shouldDisqualify = true;
          eliminationCode = EliminationCode.METABOLIC;
          reason = `Falla metabólica: Pulso excedido en rechequeo (${dto.heartRate} ppm).`;
        } else {
          // Primer intento fallido -> Aún tiene tiempo de recuperarse (VET_CHECK)
          targetStatus = ParticipantStatus.VET_CHECK;
          isFinalDecision = false;
          reason = `Requiere re-inspección: Pulso alto (${dto.heartRate} ppm).`;
        }
      }

      // Consolidar estado final:
      // "Al ingresar un rechequeo aprobado o una descalificación definitiva, el servicio debe actualizar automáticamente los estados de las inspecciones previas del mismo binomio en esa etapa a 'is_final_decision = false'."
      if (isFinalDecision) {
        await manager.update(
          VetInspection,
          {
            competition: { id: dto.competitionId },
            vetGateNumber: dto.vetGateNumber,
            riderDorsal: dto.riderDorsal,
          },
          { isFinalDecision: false },
        );
      }

      // Actualizar el estado del binomio
      entry.status = targetStatus;
      await manager.save(CompetitionEntry, entry);

      // Actualizar el hito VET_IN
      vetInRecord.isApproved = !shouldDisqualify && isFinalDecision;
      vetInRecord.eliminationType = shouldDisqualify ? eliminationCode : null;
      vetInRecord.eliminationReason =
        shouldDisqualify || !isFinalDecision ? reason : null;
      await manager.save(TimingRecord, vetInRecord);

      const attemptNum = previousInspections.length + 1;
      const isRecheckRequired = !isFinalDecision || dto.requiresRecheck;

      let nextCheckDate: Date | null = null;
      if (isRecheckRequired) {
        if (dto.nextCheckTime) {
          nextCheckDate = new Date(dto.nextCheckTime);
        } else {
          nextCheckDate = new Date(vetInTime.getTime() + 20 * 60 * 1000); // 20 minutes after vet_in
        }
      }

      // Guardar registro clínico
      const newInspection = manager.create(VetInspection, {
        tenant: entry.competition.tenant,
        competition: entry.competition,
        vetGateNumber: dto.vetGateNumber,
        riderDorsal: dto.riderDorsal,
        arrivalTime,
        vetInTime,
        heartRate: dto.heartRate,
        gaitStatus: dto.gaitStatus,
        inspectionType: dto.inspectionType,
        requiresRecheck: dto.requiresRecheck,
        attemptNumber: attemptNum,
        isRecheckRequired: isRecheckRequired,
        nextCheckTime: nextCheckDate,
        isFinalDecision,
        notes: dto.notes ? `${dto.notes} | ${reason}`.trim() : reason || null,
      });

      const savedInspection = await manager.save(newInspection);

      // Si aprueba con éxito, calcular neutralización para la salida
      if (!shouldDisqualify && isFinalDecision && !isRecheckRequired) {
        const neutralizationMins = stage.neutralizationMinutes || 60;
        arrivalRecord.scheduledDepartureTime = new Date(
          arrivalRecord.recordedAt.getTime() + neutralizationMins * 60 * 1000,
        );
        await manager.save(TimingRecord, arrivalRecord);

        // Disparar largada automática para etapa posterior
        await this.timingService.triggerAutomaticStart(manager, entry, stage);
      }

      // Transmisión reactiva vía WebSockets
      setTimeout(() => this.broadcastUpdate(dto.competitionId), 100);

      return savedInspection;
    });
  }

  private async broadcastUpdate(competitionId: string): Promise<void> {
    try {
      const leaderboard =
        await this.leaderboardService.getLiveLeaderboard(competitionId);
      this.realTimeGateway.emitLeaderboardUpdate(competitionId, leaderboard);
    } catch (err) {
      console.error(
        "[VetInspectionsService] Failed to broadcast real-time update:",
        err,
      );
    }
  }
}
