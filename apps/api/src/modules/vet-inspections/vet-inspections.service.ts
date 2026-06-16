import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, DataSource } from "typeorm";
import { VetInspection } from "./entities/vet-inspection.entity";
import { TimingRecord } from "../competitions/entities/timing-record.entity";
import { CreateVetInspectionDto } from "./dto/create-vet-inspection.dto";
import {
  TimeRecordType,
  ParticipantStatus,
  EliminationCode,
  MotricityStatus,
} from "@equuscronos/shared";
import { CompetitionEntry } from "../competition-entries/entities/competition-entry.entity";
import { TimingService } from "../timing/timing.service";

@Injectable()
export class VetInspectionsService {
  constructor(
    @InjectRepository(VetInspection)
    private readonly vetRepo: Repository<VetInspection>,
    @InjectRepository(TimingRecord)
    private readonly timingRepo: Repository<TimingRecord>,
    private readonly dataSource: DataSource,
    private readonly timingService: TimingService,
  ) {}

  async create(dto: CreateVetInspectionDto): Promise<VetInspection> {
    // 1. Cargar el registro de tiempo VET_IN con sus relaciones requeridas
    const timingRecord = await this.timingRepo.findOne({
      where: { id: dto.timingRecordId },
      relations: [
        "entry",
        "entry.competition",
        "entry.competition.tenant",
        "stage",
      ],
    });

    if (
      !timingRecord ||
      timingRecord.recordType !== TimeRecordType.VET_IN ||
      timingRecord.isVoid
    ) {
      throw new ForbiddenException(
        "Acción rechazada: No cuenta con un hito VET_IN activo en la etapa actual.",
      );
    }

    const entry = timingRecord.entry;

    // 2. Validaciones de Seguridad: Bloquear si ya está DQ, DNF o WD (Retornar 403 Forbidden)
    const invalidStatuses = [
      ParticipantStatus.DQ,
      ParticipantStatus.DNF,
      ParticipantStatus.WD,
    ];
    if (invalidStatuses.includes(entry.status)) {
      throw new ForbiddenException(
        `Acción rechazada: El binomio con dorsal ${entry.bibNumber} está fuera de competencia (${entry.status}).`,
      );
    }

    const maxHeartRate = entry.competition.maxHeartRate || 65;

    // 3. Buscar el registro ARRIVAL correspondiente para esta etapa y binomio
    const arrivalRecord = await this.timingRepo.findOne({
      where: {
        entry: { id: entry.id },
        stage: { id: timingRecord.stage.id },
        recordType: TimeRecordType.ARRIVAL,
        isVoid: false,
      },
    });

    if (!arrivalRecord) {
      throw new BadRequestException(
        "No se encontró un registro de llegada (ARRIVAL) para este binomio en la etapa actual.",
      );
    }

    // 4. Calcular diferencia de tiempo de recuperación (minuto 20)
    const diffMs =
      timingRecord.recordedAt.getTime() - arrivalRecord.recordedAt.getTime();
    const diffMinutes = diffMs / (1000 * 60);

    return await this.dataSource.transaction(async (manager) => {
      // Bloquear la inscripción por persistencia atómica y consistente
      const lockedEntry = await manager.findOne(CompetitionEntry, {
        where: { id: entry.id },
        lock: { mode: "pessimistic_write" },
      });

      if (!lockedEntry) {
        throw new NotFoundException("Inscripción no encontrada.");
      }

      if (invalidStatuses.includes(lockedEntry.status)) {
        throw new ForbiddenException(
          `Acción rechazada: El binomio con dorsal ${lockedEntry.bibNumber} está fuera de competencia (${lockedEntry.status}).`,
        );
      }

      // Validar barrera del minuto 20
      if (diffMs > 20 * 60 * 1000) {
        // Excedió el límite de 20 minutos -> Descalificación por tiempo de recuperación excedido.
        await manager.update(CompetitionEntry, entry.id, {
          status: ParticipantStatus.DQ,
        });

        await manager.update(TimingRecord, timingRecord.id, {
          isApproved: false,
          eliminationType: EliminationCode.TIME,
          eliminationReason: `Fuera de tiempo de recuperación: ${Math.round(diffMinutes)} minutos (Límite: 20 min).`,
        });

        const newInspection = manager.create(VetInspection, {
          tenant: entry.competition.tenant,
          timingRecord,
          heartRate: dto.heartRate,
          temperature: dto.temperature,
          motricity: dto.motricity,
          metabolic: dto.metabolic,
          attemptNumber: 1,
          isRecheckRequired: false,
          notes: dto.notes
            ? `${dto.notes} | Fuera de tiempo de recuperación.`
            : "Fuera de tiempo de recuperación.",
        });

        const savedInspection = await manager.save(newInspection);
        console.log(
          `[Recovery Engine] Binomio ${entry.bibNumber} descalificado automáticamente: Fuera de tiempo de recuperación.`,
        );
        return savedInspection;
      }

      // Buscar inspecciones previas de VET_IN en la misma etapa
      const previousInspections = await manager.find(VetInspection, {
        where: {
          timingRecord: {
            entry: { id: entry.id },
            stage: { id: timingRecord.stage.id },
            recordType: TimeRecordType.VET_IN,
            isVoid: false,
          },
        },
        relations: ["timingRecord"],
      });

      let attemptNumber = 1;
      let isRecheckRequired = false;
      let shouldDisqualify = false;
      let reason = "";
      let eliminationCode: EliminationCode = null;
      let targetStatus = ParticipantStatus.RESTING;

      if (previousInspections.length > 0) {
        // Validar si ya aprobó previamente
        const approvedInspection = previousInspections.find(
          (ins) =>
            ins.heartRate <= maxHeartRate &&
            ins.motricity === MotricityStatus.APTO,
        );
        if (approvedInspection) {
          throw new BadRequestException(
            "El binomio ya aprobó la inspección veterinaria en esta etapa.",
          );
        }

        if (previousInspections.length >= 2) {
          throw new BadRequestException(
            "Ya se registraron 2 intentos de inspección veterinaria para este binomio en esta etapa.",
          );
        }

        attemptNumber = 2;
      }

      // Evaluar criterios fisiológicos de trote y pulso
      if (dto.motricity === MotricityStatus.NOT_APTO) {
        shouldDisqualify = true;
        reason =
          attemptNumber === 1
            ? "Claudicación / Cojera detectada en primer intento."
            : "Claudicación / Cojera detectada en segundo intento.";
        eliminationCode = EliminationCode.GAIT;
        targetStatus = ParticipantStatus.DQ;
      } else if (dto.heartRate > maxHeartRate) {
        if (attemptNumber === 1) {
          // Intento 1 fallido por pulso -> Habilitar Intento 2
          isRecheckRequired = true;
          targetStatus = ParticipantStatus.VET_CHECK;
          reason = `Requiere rechequeo: Pulso excedido (${dto.heartRate} ppm).`;
        } else {
          // Intento 2 fallido por pulso -> DQ metabólica
          shouldDisqualify = true;
          reason = `Falla metabólica: Pulso excedido en Intento 2 (${dto.heartRate} ppm). Límite: ${maxHeartRate} ppm.`;
          eliminationCode = EliminationCode.METABOLIC;
          targetStatus = ParticipantStatus.DQ;
        }
      }

      // Actualizar estado en CompetitionEntry de forma atómica
      await manager.update(CompetitionEntry, entry.id, {
        status: targetStatus,
      });

      // Actualizar el TimingRecord de VET_IN asociado
      await manager.update(TimingRecord, timingRecord.id, {
        isApproved: !shouldDisqualify && !isRecheckRequired,
        eliminationType: shouldDisqualify ? eliminationCode : null,
        eliminationReason:
          shouldDisqualify || isRecheckRequired ? reason : null,
      });

      // Guardar inspección veterinaria
      const newInspection = manager.create(VetInspection, {
        tenant: entry.competition.tenant,
        timingRecord,
        heartRate: dto.heartRate,
        temperature: dto.temperature,
        motricity: dto.motricity,
        metabolic: dto.metabolic,
        attemptNumber,
        isRecheckRequired,
        notes: dto.notes || null,
      });

      const savedInspection = await manager.save(newInspection);
      console.log(
        `[Recovery Engine] Inspección registrada (Intento ${attemptNumber}). Estado resultante: ${targetStatus}`,
      );

      // Gatillo de Salida Inmutable: Al guardar una inspección con éxito (status PASSED / APTO)
      if (!shouldDisqualify && !isRecheckRequired) {
        arrivalRecord.scheduledDepartureTime = new Date(
          arrivalRecord.recordedAt.getTime() + 60 * 60 * 1000,
        );
        await manager.save(TimingRecord, arrivalRecord);

        // Disparar largada automática si aplica (para etapa N+1)
        await this.timingService.triggerAutomaticStart(
          manager,
          lockedEntry,
          timingRecord.stage,
        );
      }

      return savedInspection;
    });
  }
}
