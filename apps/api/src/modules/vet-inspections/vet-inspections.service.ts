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

      // 4. Garantizar registros de tiempos (TimingRecords) de contingencia
      let arrivalRecord = await manager.findOne(TimingRecord, {
        where: {
          entry: { id: entry.id },
          stage: { id: stage.id },
          recordType: TimeRecordType.ARRIVAL,
          isVoid: false,
        },
      });

      const arrivalTimeInput = new Date(dto.arrivalTime);
      const vetInTimeInput = new Date(dto.vetInTime);

      if (!arrivalRecord) {
        arrivalRecord = manager.create(TimingRecord, {
          tenant: entry.tenant,
          entry,
          stage,
          recordType: TimeRecordType.ARRIVAL,
          recordedAt: arrivalTimeInput,
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
        order: { recordedAt: "ASC" },
      });

      let vetInRecord = vetInRecords[0];

      if (!vetInRecord) {
        vetInRecord = manager.create(TimingRecord, {
          tenant: entry.tenant,
          entry,
          stage,
          recordType: TimeRecordType.VET_IN,
          recordedAt: vetInTimeInput,
          isApproved: true,
        });
        vetInRecord = await manager.save(TimingRecord, vetInRecord);
      }

      // 5. Calcular diferencia de tiempo de recuperación (Tolerancia de 20 min)
      // REGLA CRÍTICA DE NEGOCIO:
      // Si el binomio ya cuenta con un registro VET_IN previo válido (vetInRecord),
      // el timestamp a comparar contra arrivalRecord debe ser el del hito VET_IN original (vetInRecord.recordedAt)
      // en el que el caballo ingresó físicamente a la zona veterinaria, y NO el timestamp de envío del formulario de pulso/rechequeo.
      const effectiveArrivalDate = new Date(arrivalRecord.recordedAt);
      const effectiveVetInDate = new Date(vetInRecord.recordedAt);
      const diffMs = effectiveVetInDate.getTime() - effectiveArrivalDate.getTime();

      if (isNaN(diffMs) || diffMs < 0) {
        throw new BadRequestException(
          "Las fechas de llegada o ingreso al área veterinaria son inválidas.",
        );
      }

      const recoveryMinutes = diffMs / (1000 * 60);

      // Buscar inspecciones previas de la misma etapa
      const previousInspections = await manager.find(VetInspection, {
        where: {
          competition: { id: dto.competitionId },
          vetGateNumber: dto.vetGateNumber,
          riderDorsal: dto.riderDorsal,
        },
      });

      // Es rechequeo (2ª toma) SI Y SOLO SI ya existe una inspección previa registrada en esta etapa
      const isRecheck = previousInspections.length > 0;

      // REGLA FEU (Art. 21 y 31): Prohibición estricta de 3er rechequeo.
      // Si la inspección es un rechequeo (2ª toma), no se puede exigir otro rechequeo.
      if (isRecheck) {
        dto.requiresRecheck = false;
      }

      // Herencia de pulso: si el payload no incluye un nuevo heartRate (o viene <= 0),
      // heredar el heartRate de la 1ª inspección registrada para esta etapa.
      if (!dto.heartRate || isNaN(dto.heartRate) || dto.heartRate <= 0) {
        if (previousInspections.length > 0 && previousInspections[0].heartRate > 0) {
          dto.heartRate = previousInspections[0].heartRate;
        }
      }

      // El tiempo de recuperación inicial (20 min) sólo se exige en la primera inspección,
      // ya que los rechequeos ocurren en los 15 min previos a la salida de etapa.
      const isRecoveryTimeExceeded = !isRecheck && diffMs > 20 * 60 * 1000;

      const effectiveMaxHr =
        entry.competition?.maxHeartRate ??
        (entry.competition?.competitionType as any)?.defaultRules?.max_heart_rate ??
        65;

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
      } else if ((dto.heartRate ?? 0) > effectiveMaxHr) {
        // Regla 3: Pulso alto (> effectiveMaxHr ppm)
        const hadPriorPulseFailures = previousInspections.some(
          (ins) => ins.heartRate > effectiveMaxHr && ins.isFinalDecision === false,
        );

        if (
          isRecheck ||
          hadPriorPulseFailures ||
          dto.requiresRecheck === false
        ) {
          // Eliminación definitiva por pulso alto si no se concedió rechequeo -> ELIMINATED_PP
          targetStatus = ParticipantStatus.ELIMINATED_PP;
          shouldDisqualify = true;
          eliminationCode = EliminationCode.METABOLIC;
          reason = `F.C.A. - Frecuencia Cardíaca Alta: Pulso excedido (${dto.heartRate} ppm, Máx: ${effectiveMaxHr} ppm). Failed to Qualify – Metabolic.`;
        } else {
          // Primer intento fallido -> Aún tiene tiempo de recuperarse (VET_CHECK)
          targetStatus = ParticipantStatus.VET_CHECK;
          isFinalDecision = false;
          reason = `Requiere re-inspección: Pulso alto (${dto.heartRate} ppm, Máx: ${effectiveMaxHr} ppm).`;
        }
      } else if (
        !isRecheck && (
          dto.requiresRecheck ||
          dto.inspectionType === InspectionType.RE_INSPECTION_REQUESTED ||
          dto.inspectionType === InspectionType.RE_INSPECTION_MANDATORY
        )
      ) {
        // Regla 4 (Reglamento FEU Art. 21 y 31):
        // Primera toma con pulso y trote normales pero con bandera de Rechequeo marcada (trote dudoso / observación clínica).
        // Marcar un rechequeo en la 1ª toma NO aprueba al equino; se mantiene en VET_CHECK (Pendiente de Rechequeo).
        targetStatus = ParticipantStatus.VET_CHECK;
        isFinalDecision = false;
        reason = dto.notes
          ? `Rechequeo solicitado: ${dto.notes}`
          : "Requiere rechequeo veterinario (trote dudoso / observación clínica).";
      }

      // Consolidar estado final:
      // Al ingresar un rechequeo o decisión final, actualizar las inspecciones previas a is_final_decision = false.
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
      const isRecheckRequired = isRecheck
        ? false
        : shouldDisqualify
          ? false
          : !isFinalDecision || !!dto.requiresRecheck;

      let nextCheckDate: Date | null = null;
      if (isRecheckRequired) {
        if (dto.nextCheckTime) {
          nextCheckDate = new Date(dto.nextCheckTime);
        } else {
          nextCheckDate = new Date(effectiveVetInDate.getTime() + 20 * 60 * 1000); // 20 minutes after vet_in
        }
      }

      // Guardar registro clínico
      const newInspection = manager.create(VetInspection, {
        tenant: entry.competition.tenant,
        competition: entry.competition,
        vetGateNumber: dto.vetGateNumber,
        riderDorsal: dto.riderDorsal,
        arrivalTime: effectiveArrivalDate,
        vetInTime: effectiveVetInDate,
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

  async getPendingForVetGate(
    competitionId: string,
    stageNumber?: number,
  ): Promise<CompetitionEntry[]> {
    if (!competitionId) {
      throw new BadRequestException("El ID de la competencia es requerido.");
    }

    const entryRepo = this.dataSource.getRepository(CompetitionEntry);

    const entries = await entryRepo.find({
      where: [
        { competition: { id: competitionId }, status: ParticipantStatus.VET_CHECK },
        { competition: { id: competitionId }, status: ParticipantStatus.IN_RACE },
      ],
      relations: [
        "rider",
        "horse",
        "horse.owner",
        "representedTenant",
        "currentStage",
        "timingRecords",
        "timingRecords.stage",
        "tenant",
      ],
      order: { bibNumber: "ASC" },
    });

    const allVetInspections = await this.vetRepo.find({
      where: { competition: { id: competitionId } },
    });

    return entries.filter((entry) => {
      const activeStageNum = stageNumber ?? entry.currentStage?.stageNumber;
      if (!activeStageNum) return false;

      // Exigir existencia explícita de TimingRecord de tipo VET_IN en la etapa correspondiente
      const vetInRecord = entry.timingRecords?.find(
        (tr) =>
          tr.recordType === TimeRecordType.VET_IN &&
          !tr.isVoid &&
          tr.stage?.stageNumber === activeStageNum,
      );

      if (!vetInRecord) {
        // Excluir competidores que sólo tengan ARRIVAL o carezcan de VET_IN
        return false;
      }

      // Verificar inspecciones previas en esta etapa
      const stageInspections = allVetInspections.filter(
        (vi) =>
          vi.vetGateNumber === activeStageNum &&
          vi.riderDorsal === String(entry.bibNumber),
      );

      if (stageInspections.length > 0) {
        const lastInsp = stageInspections[stageInspections.length - 1];
        if (
          lastInsp.isFinalDecision &&
          !lastInsp.requiresRecheck &&
          !lastInsp.isRecheckRequired
        ) {
          return false;
        }
      }

      return true;
    });
  }

  async deleteLastInspection(id: string): Promise<any> {
    if (!id) {
      throw new BadRequestException("El ID de la inspección es requerido.");
    }

    return await this.dataSource.transaction(async (manager: EntityManager) => {
      // 1. Cargar inspección a eliminar con bloqueo pesimista
      const inspectionToLock = await manager.findOne(VetInspection, {
        where: { id },
        lock: { mode: "pessimistic_write" },
      });

      if (!inspectionToLock) {
        throw new NotFoundException(
          `Inspección veterinaria con ID ${id} no encontrada.`,
        );
      }

      const inspection = await manager.findOne(VetInspection, {
        where: { id: inspectionToLock.id },
        relations: ["competition", "competition.tenant", "tenant"],
      });

      if (!inspection) {
        throw new NotFoundException(
          `Inspección veterinaria con ID ${id} no encontrada.`,
        );
      }

      const bibNum = parseInt(inspection.riderDorsal, 10);
      if (isNaN(bibNum)) {
        throw new BadRequestException("Dorsal de jinete inválido.");
      }

      // 2. Buscar y bloquear la inscripción (CompetitionEntry)
      const entryToLock = await manager.findOne(CompetitionEntry, {
        where: {
          competition: { id: inspection.competition.id },
          bibNumber: bibNum,
        },
      });

      if (!entryToLock) {
        throw new NotFoundException(
          `Binomio con dorsal #${inspection.riderDorsal} no encontrado en la competencia.`,
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
          "tenant",
          "currentStage",
          "timingRecords",
          "timingRecords.stage",
        ],
      });

      if (!entry) {
        throw new NotFoundException("Inscripción no encontrada.");
      }

      // 3. Validar que la inspección a eliminar sea efectivamente la última realizada para dicho competidor en esta etapa
      const stageInspections = await manager.find(VetInspection, {
        where: {
          competition: { id: inspection.competition.id },
          vetGateNumber: inspection.vetGateNumber,
          riderDorsal: inspection.riderDorsal,
        },
        order: { createdAt: "DESC" },
      });

      if (stageInspections.length === 0 || stageInspections[0].id !== id) {
        throw new BadRequestException(
          "Acción denegada: Solo se permite eliminar el último registro veterinario ingresado para este competidor en esta etapa.",
        );
      }

      // 4. Validar condiciones de guardia: si el competidor ya largó o registró tiempos en etapas posteriores o avanzó en la carrera
      const allTimingRecords = await manager.find(TimingRecord, {
        where: {
          entry: { id: entry.id },
          isVoid: false,
        },
        relations: ["stage"],
      });

      const hasSubsequentRecords = allTimingRecords.some(
        (tr) =>
          (tr.stage?.stageNumber ?? 0) > inspection.vetGateNumber ||
          (tr.stage?.stageNumber === inspection.vetGateNumber &&
            tr.recordType === TimeRecordType.VET_OUT),
      );

      if (hasSubsequentRecords) {
        throw new BadRequestException(
          "No se puede eliminar el control: el competidor ya largó la siguiente etapa o registró eventos posteriores.",
        );
      }

      // 5. Restablecer tiempos e hitos de neutralización/largada si existieran
      // a) Limpiar scheduledDepartureTime en el registro ARRIVAL de la etapa actual
      const arrivalRecord = allTimingRecords.find(
        (tr) =>
          tr.stage?.stageNumber === inspection.vetGateNumber &&
          tr.recordType === TimeRecordType.ARRIVAL,
      );

      if (arrivalRecord) {
        arrivalRecord.scheduledDepartureTime = null;
        await manager.save(TimingRecord, arrivalRecord);
      }

      // b) Eliminar cualquier registro de START automático creado en la siguiente etapa (N+1)
      const nextStageNum = inspection.vetGateNumber + 1;
      const nextStageStart = allTimingRecords.find(
        (tr) =>
          tr.stage?.stageNumber === nextStageNum &&
          tr.recordType === TimeRecordType.START,
      );

      if (nextStageStart) {
        await manager.remove(TimingRecord, nextStageStart);
      }

      // c) Revertir estado del hito VET_IN en la etapa actual
      const vetInRecord = allTimingRecords.find(
        (tr) =>
          tr.stage?.stageNumber === inspection.vetGateNumber &&
          tr.recordType === TimeRecordType.VET_IN,
      );

      if (vetInRecord) {
        vetInRecord.isApproved = false;
        vetInRecord.eliminationType = null;
        vetInRecord.eliminationReason = null;
        await manager.save(TimingRecord, vetInRecord);
      }

      // 6. Eliminar el registro en vet_inspections (dispara automáticamente AuditSubscriber.afterRemove)
      await manager.remove(VetInspection, inspection);

      // 7. Reevaluar y restaurar el estado del CompetitionEntry
      const remainingInspections = stageInspections.filter(
        (vi) => vi.id !== id,
      );

      if (remainingInspections.length > 0) {
        // Quedan inspecciones previas (ej. se eliminó la 2ª toma, quedando la 1ª)
        const prevInsp = remainingInspections[0]; // La más reciente de las previas
        prevInsp.isFinalDecision = true;
        await manager.save(VetInspection, prevInsp);

        const effectiveMaxHr =
          entry.competition?.maxHeartRate ??
          (entry.competition?.competitionType as any)?.defaultRules?.max_heart_rate ??
          65;

        if (prevInsp.requiresRecheck || prevInsp.isRecheckRequired) {
          entry.status = ParticipantStatus.VET_CHECK;
        } else if (prevInsp.gaitStatus === GaitStatus.LAMENESS_ELIMINATED) {
          entry.status = ParticipantStatus.ELIMINATED_GAIT;
        } else if (prevInsp.heartRate > effectiveMaxHr) {
          entry.status = ParticipantStatus.ELIMINATED_PP;
        } else {
          entry.status = ParticipantStatus.RESTING;
        }
      } else {
        // No quedan inspecciones en la etapa -> El binomio vuelve a estar pendiente (VET_CHECK)
        entry.status = ParticipantStatus.VET_CHECK;
        const currentStage = await manager.findOne(Stage, {
          where: {
            competition: { id: inspection.competition.id },
            stageNumber: inspection.vetGateNumber,
          },
        });
        if (currentStage) {
          entry.currentStage = currentStage;
        }
      }

      await manager.save(CompetitionEntry, entry);

      // 8. Transmisión reactiva vía WebSockets
      setTimeout(() => this.broadcastUpdate(inspection.competition.id), 100);

      return {
        success: true,
        message: `Inspección veterinaria del dorsal #${inspection.riderDorsal} eliminada correctamente.`,
        deletedInspectionId: id,
      };
    });
  }
}


