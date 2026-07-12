import {
  Injectable,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
  ForbiddenException,
  OnModuleInit,
  OnModuleDestroy,
} from "@nestjs/common";
import { DataSource, EntityManager } from "typeorm";
import { TimingRecord } from "../competitions/entities/timing-record.entity";
import { CompetitionEntry } from "../competition-entries/entities/competition-entry.entity";
import { Stage } from "../competitions/entities/stage.entity";
import { Competition } from "../competitions/entities/competition.entity";
import { CreateTimingRecordDto } from "./dto/create-timing.dto";
import {
  TimeRecordType,
  ParticipantStatus,
  CompetitionStatus,
  GaitStatus,
  EliminationCode,
} from "@equuscronos/shared";
import { TimeCalculationService } from "./services/time-calculation.service";
import { VetInspection } from "../vet-inspections/entities/vet-inspection.entity";

@Injectable()
export class TimingService implements OnModuleInit, OnModuleDestroy {
  private scannerInterval: NodeJS.Timeout;

  constructor(
    // Inyectamos DataSource para controlar transacciones seguras
    private readonly dataSource: DataSource,
    private readonly timeCalcService: TimeCalculationService,
  ) {}

  /**
   * Registra un hito de cronometraje en pista garantizando integridad ACID
   * y bloqueos contra concurrencia de antenas RFID.
   */
  async create(
    dto: CreateTimingRecordDto,
    currentUserTenantId?: string,
  ): Promise<TimingRecord> {
    // 1. Validación de Entrada (Failsafe)
    if (!dto.bibNumber && !dto.chipId) {
      throw new BadRequestException(
        "Se requiere Dorsal (bibNumber) o Chip RFID (chipId) para registrar el tiempo.",
      );
    }

    // El bloqueo pesimista y la validación de 60 minutos garantizan la integridad de la carrera y evitan sanciones de la FEU.
    // TRANSACCIÓN SEGURA: Todo se ejecuta o nada se guarda
    return await this.dataSource.transaction(async (manager: EntityManager) => {
      // 2. Búsqueda con Bloqueo Pesimista (Evita duplicidad si 2 jueces envían el mismo dato al mismo tiempo)
      // 2. Búsqueda con Bloqueo Pesimista (Evita duplicidad si 2 jueces envían el mismo dato al mismo tiempo)
      // Primero encontramos el ID del binomio sin bloquear (permite joins)
      const entryToLock = await manager.findOne(CompetitionEntry, {
        where: dto.chipId
          ? {
              competition: { id: dto.competitionId },
              horse: { chipId: dto.chipId },
            }
          : {
              competition: { id: dto.competitionId },
              bibNumber: dto.bibNumber,
            },
      });

      if (!entryToLock) {
        throw new NotFoundException(
          `Binomio no encontrado en la competencia activa.`,
        );
      }

      // Ahora bloqueamos la fila específica por su ID primario (sin joins, evitando error de Postgres FOR UPDATE)
      const lockedEntry = await manager.findOne(CompetitionEntry, {
        where: { id: entryToLock.id },
        lock: { mode: "pessimistic_write" },
      });

      if (!lockedEntry) {
        throw new NotFoundException(
          `Binomio no encontrado en la competencia activa.`,
        );
      }

      // Cargamos las relaciones asociadas bajo la seguridad de la transacción bloqueada
      const entry = await manager.findOne(CompetitionEntry, {
        where: { id: lockedEntry.id },
        relations: [
          "competition",
          "competition.tenant",
          "competition.stages",
          "horse",
          "rider",
          "tenant",
        ],
      });

      if (!entry) {
        throw new NotFoundException(
          `Binomio no encontrado en la competencia activa.`,
        );
      }

      if (
        currentUserTenantId &&
        entry.competition?.tenant?.id !== currentUserTenantId
      ) {
        throw new ForbiddenException(
          "Acción denegada: La competencia pertenece a otra organización/club (Multi-Tenant Isolation).",
        );
      }

      if (
        dto.recordType === TimeRecordType.START &&
        entry.competition.status !== CompetitionStatus.ACTIVE
      ) {
        throw new ForbiddenException(
          "La competencia no está activa. No se pueden registrar marcas START en una competencia que no esté en estado ACTIVE.",
        );
      }

      // 3. Validación de Estado del Competidor
      const invalidStatuses = [
        ParticipantStatus.DQ,
        ParticipantStatus.DNF,
        ParticipantStatus.WD,
      ];

      if (invalidStatuses.includes(entry.status)) {
        throw new BadRequestException(
          `Acción rechazada: El dorsal ${entry.bibNumber} está fuera de competencia (${entry.status}).`,
        );
      }

      const immutableStatuses = [
        ParticipantStatus.FINISHED_PROVISIONAL,
        ParticipantStatus.FINISHED,
        ParticipantStatus.NO_COMPLETED,
      ];

      if (immutableStatuses.includes(entry.status)) {
        throw new BadRequestException(
          `Acción rechazada: El dorsal ${entry.bibNumber} ya ha finalizado la competencia (Estado: ${entry.status}).`,
        );
      }

      // 4. Validación de Secuencia Lógica FEU (Máquina de Estados)
      const existingRecords = await manager.find(TimingRecord, {
        where: { entry: { id: entry.id }, stage: { id: dto.stageId } },
        relations: ["stage"],
      });

      const currentStage = await manager.findOne(Stage, {
        where: { id: dto.stageId },
      });
      if (!currentStage) throw new NotFoundException("Etapa no encontrada.");

      const stages = entry.competition.stages || [];
      stages.sort((a, b) => a.stageNumber - b.stageNumber);
      const lastStageObj = stages[stages.length - 1];
      const isLastStage = lastStageObj && lastStageObj.id === dto.stageId;

      const vetInspections = await manager.find(VetInspection, {
        where: {
          competition: { id: entry.competition.id },
          vetGateNumber: currentStage.stageNumber,
          riderDorsal: String(entry.bibNumber),
        },
        order: { createdAt: "ASC" },
      });

      this.validateLogicalSequence(
        dto.recordType,
        existingRecords,
        vetInspections,
        isLastStage,
      );

      // 5. Persistencia del Tiempo
      try {
        // Obtenemos la etapa actual completa para saber su neutralización
        const stage = await manager.findOne(Stage, {
          where: { id: dto.stageId },
        });
        if (!stage) throw new NotFoundException("Etapa no encontrada.");

        let scheduledDepartureTime = null;
        // Si es LLEGADA y NO es la última etapa, calculamos la hora en que debe largar la siguiente etapa
        if (dto.recordType === TimeRecordType.ARRIVAL && !isLastStage) {
          scheduledDepartureTime =
            this.timeCalcService.calculateNextDepartureTime(
              new Date(dto.recordedAt),
              stage,
            );
        }

        let isApproved = dto.isApproved ?? true;
        let eliminationType = null;
        let eliminationReason = null;
        let isLateVetIn = false;

        if (dto.recordType === TimeRecordType.VET_IN) {
          const arrivalRecord = existingRecords.find(
            (r) => r.recordType === TimeRecordType.ARRIVAL && !r.isVoid,
          );
          if (arrivalRecord) {
            const diffMs =
              new Date(dto.recordedAt).getTime() -
              new Date(arrivalRecord.recordedAt).getTime();
            if (diffMs > 20 * 60 * 1000) {
              const diffMinutes = diffMs / (1000 * 60);
              isApproved = false;
              eliminationType = EliminationCode.TIME;
              eliminationReason = `Fuera de tiempo de recuperación: ${Math.round(diffMinutes)} minutos (Límite: 20 min).`;
              isLateVetIn = true;
            }
          }
        }

        if (isLastStage && dto.recordType === TimeRecordType.ARRIVAL) {
          // Check if competition.controlClosureTime is set and exceeded
          const freshComp = await manager.findOne(Competition, {
            where: { id: entry.competition.id },
          });
          if (freshComp && freshComp.controlClosureTime) {
            const isLate =
              new Date(dto.recordedAt).getTime() >
              new Date(freshComp.controlClosureTime).getTime();
            if (isLate) {
              isApproved = false;
              eliminationType = EliminationCode.TIME;
              eliminationReason = `Excedió la tolerancia de control de cierre del Art. 32 (Límite: ${new Date(freshComp.controlClosureTime).toISOString()}).`;
            }
          }
        }

        const newRecord = manager.create(TimingRecord, {
          tenant: entry.tenant,
          entry,
          stage: { id: dto.stageId },
          recordType: dto.recordType,
          recordedAt: new Date(dto.recordedAt),
          isApproved: isApproved,
          eliminationType: eliminationType,
          eliminationReason: eliminationReason,
          scheduledDepartureTime: scheduledDepartureTime,
          isAutomatic: dto.isAutomatic ?? false,
        });

        const savedRecord = await manager.save(newRecord);

        // 6. Sincronización del Estado del Competidor
        await this.syncEntryState(manager, entry, dto, isLateVetIn);

        // 6b. Detección de hora cero para cierre de control (meta final del primer binomio clasificado)
        if (dto.recordType === TimeRecordType.ARRIVAL && isApproved) {
          const stages = await manager.find(Stage, {
            where: { competition: { id: entry.competition.id } },
            order: { stageNumber: "ASC" },
          });
          const lastStage = stages[stages.length - 1];
          if (lastStage && lastStage.id === dto.stageId) {
            const competition = await manager.findOne(Competition, {
              where: { id: entry.competition.id },
              relations: ["competitionType"],
            });
            if (competition && !competition.controlClosureTime) {
              const totalDistance = stages.reduce(
                (sum, s) => sum + Number(s.distanceKm || 0),
                0,
              );
              const rulesConfig =
                competition.competitionType?.rulesConfig || {};
              const rulesList = rulesConfig.distance_tolerance_rules || [];

              let toleranceMins = 30;
              const matchedRule = rulesList.find((r: any) => {
                const minOk =
                  r.min_distance === null ||
                  r.min_distance === undefined ||
                  totalDistance >= Number(r.min_distance);
                const maxOk =
                  r.max_distance === null ||
                  r.max_distance === undefined ||
                  totalDistance < Number(r.max_distance);
                return minOk && maxOk;
              });

              if (matchedRule) {
                toleranceMins = Number(matchedRule.tolerance_minutes);
              } else {
                if (totalDistance < 80) {
                  toleranceMins = 30;
                } else if (totalDistance >= 80 && totalDistance < 100) {
                  toleranceMins = 45;
                } else {
                  toleranceMins = 60;
                }
              }

              const winnerTimestamp = new Date(dto.recordedAt);
              const closureTime = new Date(
                winnerTimestamp.getTime() + toleranceMins * 60 * 1000,
              );

              competition.controlClosureTime = closureTime;
              await manager.save(Competition, competition);

              console.log(
                `[Control Closure] Winner arrived. Total distance: ${totalDistance} km. Tolerance: ${toleranceMins} mins. Control closure time set to: ${closureTime.toISOString()}`,
              );
            }
          }
        }

        if (
          dto.recordType === TimeRecordType.VET_OUT &&
          (dto.isApproved ?? true)
        ) {
          await this.triggerAutomaticStart(manager, entry, stage);
        }

        return savedRecord;
      } catch (error) {
        throw new InternalServerErrorException(
          `Error crítico al persistir el tiempo: ${error.message}`,
        );
      }
    });
  }

  /**
   * Asegura que las leyes de la física y el Reglamento FEU no se rompan en el software.
   */
  private validateLogicalSequence(
    newRecordType: TimeRecordType,
    existingRecords: TimingRecord[],
    vetInspections: VetInspection[],
    isLastStage: boolean = false,
  ): void {
    if (
      isLastStage &&
      (newRecordType === TimeRecordType.VET_IN ||
        newRecordType === TimeRecordType.VET_OUT)
    ) {
      throw new BadRequestException(
        "Acción denegada: No se permiten registros veterinarios (VET_IN / VET_OUT) en la última etapa de la competencia.",
      );
    }

    const hasStart = existingRecords.some(
      (r) => r.recordType === TimeRecordType.START,
    );
    const hasArrival = existingRecords.some(
      (r) => r.recordType === TimeRecordType.ARRIVAL,
    );

    // Regla 1: Un evento no puede ocurrir dos veces en la misma etapa, salvo VET_IN si requiere rechequeo
    if (existingRecords.some((r) => r.recordType === newRecordType)) {
      if (newRecordType === TimeRecordType.VET_IN) {
        const vetInRecords = existingRecords.filter(
          (r) => r.recordType === TimeRecordType.VET_IN,
        );
        if (vetInRecords.length >= 2) {
          throw new BadRequestException(
            "Máximo de 2 intentos de inspección veterinaria (VET_IN) permitidos por etapa.",
          );
        }

        const firstInspection = vetInspections[0];
        if (!firstInspection) {
          throw new BadRequestException(
            "No se puede registrar un segundo intento de VET_IN si el primero aún no ha sido inspeccionado.",
          );
        }
        if (!firstInspection.isRecheckRequired) {
          throw new BadRequestException(
            "No se puede registrar un segundo intento de VET_IN si el primero ya fue aprobado o descalificado definitivamente.",
          );
        }
      } else {
        throw new BadRequestException(
          `Dato duplicado: El hito [${newRecordType}] ya fue registrado en esta etapa para este binomio.`,
        );
      }
    }

    // Regla 2: El orden causal (Línea de Tiempo FEU)
    if (newRecordType === TimeRecordType.ARRIVAL && !hasStart) {
      throw new BadRequestException(
        "Secuencia inválida: No se puede registrar LLEGADA (ARRIVAL) sin una LARGADA (START) previa.",
      );
    }

    // Regla 3: El orden causal (Línea de Tiempo FEU)
    if (newRecordType === TimeRecordType.VET_IN && !hasArrival) {
      throw new BadRequestException(
        "Secuencia inválida: No se puede registrar ingreso veterinario (VET_IN) sin haber cruzado la meta (ARRIVAL).",
      );
    }
  }

  /**
   * Actualiza el estado principal del participante basándose en el hito temporal.
   */
  private async syncEntryState(
    manager: EntityManager,
    entry: CompetitionEntry,
    dto: CreateTimingRecordDto,
    isLateVetIn: boolean = false,
  ): Promise<void> {
    let newStatus = entry.status;

    if (dto.recordType === TimeRecordType.START) {
      newStatus = ParticipantStatus.IN_RACE;
    } else if (dto.recordType === TimeRecordType.VET_IN) {
      if (isLateVetIn) {
        newStatus = ParticipantStatus.DQ;
      } else {
        newStatus = ParticipantStatus.VET_CHECK;
      }
    } else if (dto.recordType === TimeRecordType.ARRIVAL) {
      const stages = entry.competition?.stages || [];
      if (stages.length > 0) {
        stages.sort((a, b) => a.stageNumber - b.stageNumber);
        const lastStage = stages[stages.length - 1];
        const isLastStage = lastStage && lastStage.id === dto.stageId;

        if (isLastStage) {
          const freshComp = await manager.findOne(Competition, {
            where: { id: entry.competition.id },
          });
          const isLate =
            freshComp &&
            freshComp.controlClosureTime &&
            new Date(dto.recordedAt).getTime() >
              new Date(freshComp.controlClosureTime).getTime();

          if (isLate) {
            newStatus = ParticipantStatus.NO_COMPLETED;
          } else {
            newStatus = ParticipantStatus.FINISHED_PROVISIONAL;
          }
        }
      }
    }

    await manager.update(CompetitionEntry, entry.id, {
      status: newStatus,
      currentStage: { id: dto.stageId },
    });
  }

  /**
   * Anula un registro de tiempos (isVoid = true) guardando una justificación.
   * Restablece el estado del competidor según el último hito activo.
   */
  async void(
    id: string,
    voidReason: string,
    userRole?: string,
  ): Promise<TimingRecord> {
    return await this.dataSource.transaction(async (manager: EntityManager) => {
      const recordToLock = await manager.findOne(TimingRecord, {
        where: { id },
        lock: { mode: "pessimistic_write" },
      });

      if (!recordToLock) {
        throw new NotFoundException(
          `Registro de tiempo con ID ${id} no encontrado.`,
        );
      }

      const record = await manager.findOne(TimingRecord, {
        where: { id: recordToLock.id },
        relations: ["entry", "stage", "tenant"],
      });

      if (!record) {
        throw new NotFoundException(
          `Registro de tiempo con ID ${id} no encontrado.`,
        );
      }

      if (record.recordType === TimeRecordType.START && record.isAutomatic) {
        if (userRole !== "ADMIN" && userRole !== "ORGANIZER") {
          throw new ForbiddenException(
            "El registro de largada automático es inmutable desde la aplicación móvil. Solo un administrador puede modificarlo o anularlo desde la consola web.",
          );
        }
      }

      if (record.isVoid) {
        throw new BadRequestException("El registro ya ha sido anulado.");
      }

      record.isVoid = true;
      record.voidReason = voidReason;

      const savedRecord = await manager.save(record);

      // Rollback participant status if necessary
      const activeRecords = await manager.find(TimingRecord, {
        where: { entry: { id: record.entry.id }, isVoid: false },
        order: { recordedAt: "DESC" },
      });

      const latestRecord = activeRecords.length > 0 ? activeRecords[0] : null;
      const targetStatus = this.getStatusForLatestRecord(
        latestRecord ? latestRecord.recordType : null,
      );

      await manager.update(CompetitionEntry, record.entry.id, {
        status: targetStatus,
      });

      console.log(
        `[Void] Record ${id} voided. Competitor status rolled back to ${targetStatus}`,
      );

      return savedRecord;
    });
  }

  private getStatusForLatestRecord(
    recordType: TimeRecordType | null,
  ): ParticipantStatus {
    if (!recordType) return ParticipantStatus.IN_RACE;
    switch (recordType) {
      case TimeRecordType.START:
        return ParticipantStatus.IN_RACE;
      case TimeRecordType.ARRIVAL:
      case TimeRecordType.VET_IN:
        return ParticipantStatus.VET_CHECK;
      case TimeRecordType.VET_OUT:
        return ParticipantStatus.RESTING;
      default:
        return ParticipantStatus.IN_RACE;
    }
  }

  /**
   * Actualiza el timestamp de un registro de tiempo.
   * Se restringe a la misma etapa y antes de la presentación veterinaria (VET_IN).
   */
  async updateRecord(
    id: string,
    recordedAt: string,
    userRole?: string,
  ): Promise<TimingRecord> {
    return await this.dataSource.transaction(async (manager: EntityManager) => {
      const recordToLock = await manager.findOne(TimingRecord, {
        where: { id },
        lock: { mode: "pessimistic_write" },
      });

      if (!recordToLock) {
        throw new NotFoundException(
          `Registro de tiempo con ID ${id} no encontrado.`,
        );
      }

      const record = await manager.findOne(TimingRecord, {
        where: { id: recordToLock.id },
        relations: ["entry", "stage", "tenant"],
      });

      if (!record) {
        throw new NotFoundException(
          `Registro de tiempo con ID ${id} no encontrado.`,
        );
      }

      if (record.recordType === TimeRecordType.START && record.isAutomatic) {
        if (userRole !== "ADMIN" && userRole !== "ORGANIZER") {
          throw new ForbiddenException(
            "El registro de largada automático es inmutable desde la aplicación móvil. Solo un administrador puede modificarlo o anularlo desde la consola web.",
          );
        }
      }

      if (record.isVoid) {
        throw new BadRequestException(
          "No se puede modificar un registro anulado.",
        );
      }

      // Validar: "siempre que sea dentro de la misma etapa y antes de la presentación olímpica"
      if (record.recordType === TimeRecordType.ARRIVAL) {
        const hasVetIn = await manager.findOne(TimingRecord, {
          where: {
            entry: { id: record.entry.id },
            stage: { id: record.stage.id },
            recordType: TimeRecordType.VET_IN,
            isVoid: false,
          },
        });
        if (hasVetIn) {
          throw new BadRequestException(
            "No se puede modificar el registro de llegada (ARRIVAL) porque el binomio ya ingresó a la mesa veterinaria (VET_IN).",
          );
        }
      } else if (record.recordType === TimeRecordType.START) {
        const hasArrival = await manager.findOne(TimingRecord, {
          where: {
            entry: { id: record.entry.id },
            stage: { id: record.stage.id },
            recordType: TimeRecordType.ARRIVAL,
            isVoid: false,
          },
        });
        if (hasArrival) {
          throw new BadRequestException(
            "No se puede modificar el registro de largada (START) porque el binomio ya registró su llegada (ARRIVAL).",
          );
        }
      }

      record.recordedAt = new Date(recordedAt);

      // Recalcular scheduledDepartureTime si el registro es una LLEGADA (ARRIVAL)
      if (record.recordType === TimeRecordType.ARRIVAL) {
        const stage = await manager.findOne(Stage, {
          where: { id: record.stage.id },
        });
        if (stage) {
          record.scheduledDepartureTime =
            this.timeCalcService.calculateNextDepartureTime(
              record.recordedAt,
              stage,
            );
        }
      }

      const savedRecord = await manager.save(record);
      console.log(
        `[Update] Record ${id} updated with new timestamp ${recordedAt}`,
      );

      return savedRecord;
    });
  }

  async onModuleInit() {
    // Iniciar escáner periódico en segundo plano
    this.scannerInterval = setInterval(() => {
      this.scanAndTriggerAutomaticStarts().catch((err) => {
        console.error("[TimingService] Background scanner error:", err);
      });
    }, 10000); // Cada 10 segundos
  }

  onModuleDestroy() {
    if (this.scannerInterval) {
      clearInterval(this.scannerInterval);
    }
  }

  async triggerAutomaticStart(
    manager: EntityManager,
    entry: CompetitionEntry,
    currentStage: Stage,
  ): Promise<void> {
    // Si la relación competition o tenant no está cargada, la cargamos desde la base de datos
    if (!entry.competition || !entry.tenant) {
      const dbEntry = await manager.findOne(CompetitionEntry, {
        where: { id: entry.id },
        relations: ["competition", "tenant"],
      });
      if (dbEntry) {
        entry = dbEntry;
      }
    }

    // 1. Verificar si existe una etapa N+1
    const nextStage = await manager.findOne(Stage, {
      where: {
        competition: { id: entry.competition.id },
        stageNumber: currentStage.stageNumber + 1,
      },
    });
    if (!nextStage) {
      console.log(
        `[Auto Start] No hay etapa posterior (N+1) para la etapa ${currentStage.stageNumber}.`,
      );
      return;
    }

    // 2. Hard Guard: El binomio tiene VET_IN aprobado con status APTO
    const vetInRecord = await manager.findOne(TimingRecord, {
      where: {
        entry: { id: entry.id },
        stage: { id: currentStage.id },
        recordType: TimeRecordType.VET_IN,
        isApproved: true,
        isVoid: false,
      },
    });

    const vetInspection = await manager.findOne(VetInspection, {
      where: {
        competition: { id: entry.competition.id },
        vetGateNumber: currentStage.stageNumber,
        riderDorsal: String(entry.bibNumber),
        isFinalDecision: true,
      },
    });

    if (
      !vetInRecord ||
      !vetInspection ||
      vetInspection.gaitStatus !== GaitStatus.APPROVED
    ) {
      console.log(
        `[Auto Start] Abortado: El binomio dorsal ${entry.bibNumber} no cuenta con inspección veterinaria VET_IN Aprobada (APPROVED).`,
      );
      return;
    }

    // 3. Evaluar elegibilidad
    const eligibility = await this.validateDepartureEligibility(entry, manager);
    if (
      eligibility.eligible &&
      eligibility.nextStage &&
      eligibility.scheduledDepartureTime
    ) {
      // Si el horario ya pasó, ejecutar inmediatamente
      await this.executeAutomaticStart(
        manager,
        entry,
        eligibility.nextStage,
        eligibility.scheduledDepartureTime,
      );
    } else if (eligibility.scheduledDepartureTime && eligibility.nextStage) {
      // Si el horario es a futuro, programar un setTimeout
      const delay = eligibility.scheduledDepartureTime.getTime() - Date.now();
      if (delay > 0) {
        setTimeout(async () => {
          try {
            await this.triggerAutomaticStartFromScheduled(
              entry.id,
              currentStage.id,
            );
          } catch (err) {
            console.error(
              "[Auto Start] Error running scheduled automatic start:",
              err,
            );
          }
        }, delay);
        console.log(
          `[Auto Start] Programada largada automática del dorsal ${entry.bibNumber} en etapa ${eligibility.nextStage.stageNumber} para las ${eligibility.scheduledDepartureTime} (en ${Math.round(delay / 1000)} segundos).`,
        );
      }
    }
  }

  async triggerAutomaticStartFromScheduled(
    entryId: string,
    currentStageId: string,
  ): Promise<void> {
    await this.dataSource.transaction(async (manager: EntityManager) => {
      const lockedEntry = await manager.findOne(CompetitionEntry, {
        where: { id: entryId },
        lock: { mode: "pessimistic_write" },
      });
      if (!lockedEntry) return;

      const entry = await manager.findOne(CompetitionEntry, {
        where: { id: lockedEntry.id },
        relations: [
          "competition",
          "competition.tenant",
          "tenant",
          "currentStage",
        ],
      });
      if (!entry) return;

      const currentStage = await manager.findOne(Stage, {
        where: { id: currentStageId },
      });
      if (!currentStage) return;

      const eligibility = await this.validateDepartureEligibility(
        entry,
        manager,
      );
      if (
        eligibility.eligible &&
        eligibility.nextStage &&
        eligibility.scheduledDepartureTime
      ) {
        const existingStart = await manager.findOne(TimingRecord, {
          where: {
            entry: { id: entry.id },
            stage: { id: eligibility.nextStage.id },
            recordType: TimeRecordType.START,
            isVoid: false,
          },
        });
        if (!existingStart) {
          await this.executeAutomaticStart(
            manager,
            entry,
            eligibility.nextStage,
            eligibility.scheduledDepartureTime,
          );
        }
      }
    });
  }

  async validateDepartureEligibility(
    entry: CompetitionEntry,
    manager?: EntityManager,
  ): Promise<{
    eligible: boolean;
    reason?: string;
    scheduledDepartureTime?: Date;
    nextStage?: Stage;
  }> {
    const mgr = manager || this.dataSource.manager;
    let fullEntry = entry;
    if (!entry.currentStage || !entry.competition) {
      fullEntry = await mgr.findOne(CompetitionEntry, {
        where: { id: entry.id },
        relations: ["currentStage", "competition"],
      });
      if (!fullEntry) {
        return { eligible: false, reason: "Inscripción no encontrada." };
      }
    }

    const currentStage = fullEntry.currentStage;
    if (!currentStage) {
      return {
        eligible: false,
        reason: "El binomio no se encuentra en ninguna etapa activa.",
      };
    }

    // a) El binomio tiene VET_IN aprobado en la etapa anterior (que es la etapa actual del entry, currentStage)
    const vetIn = await mgr.findOne(TimingRecord, {
      where: {
        entry: { id: fullEntry.id },
        stage: { id: currentStage.id },
        recordType: TimeRecordType.VET_IN,
        isApproved: true,
        isVoid: false,
      },
    });
    if (!vetIn) {
      return {
        eligible: false,
        reason:
          "El binomio no tiene un hito VET_IN aprobado para la etapa actual.",
      };
    }

    // b) No existe bandera de DQ o DNF.
    const invalidStatuses = [
      ParticipantStatus.DQ,
      ParticipantStatus.DNF,
      ParticipantStatus.WD,
    ];
    if (invalidStatuses.includes(fullEntry.status)) {
      return {
        eligible: false,
        reason: `El binomio está fuera de competencia (${fullEntry.status}).`,
      };
    }

    const vetInspection = await mgr.findOne(VetInspection, {
      where: {
        competition: { id: fullEntry.competition.id },
        vetGateNumber: currentStage.stageNumber,
        riderDorsal: String(fullEntry.bibNumber),
        isFinalDecision: true,
      },
    });

    if (vetInspection && vetInspection.isRecheckRequired) {
      return {
        eligible: false,
        reason:
          "El binomio requiere un rechequeo veterinario obligatorio antes de largar.",
      };
    }

    // c) El tiempo actual es >= scheduled_departure_time.
    const arrival = await mgr.findOne(TimingRecord, {
      where: {
        entry: { id: fullEntry.id },
        stage: { id: currentStage.id },
        recordType: TimeRecordType.ARRIVAL,
        isVoid: false,
      },
    });
    if (!arrival || !arrival.scheduledDepartureTime) {
      return {
        eligible: false,
        reason:
          "No se encontró el hito ARRIVAL o su hora de largada programada (scheduledDepartureTime).",
      };
    }

    const nextStage = await mgr.findOne(Stage, {
      where: {
        competition: { id: fullEntry.competition.id },
        stageNumber: currentStage.stageNumber + 1,
      },
    });
    if (!nextStage) {
      return {
        eligible: false,
        reason:
          "No existe una etapa posterior (N+1) configurada para esta competencia.",
      };
    }

    const now = new Date();
    if (now.getTime() < arrival.scheduledDepartureTime.getTime()) {
      return {
        eligible: false,
        reason: "Aún no se ha cumplido la hora programada de largada.",
        scheduledDepartureTime: arrival.scheduledDepartureTime,
        nextStage,
      };
    }

    return {
      eligible: true,
      scheduledDepartureTime: arrival.scheduledDepartureTime,
      nextStage,
    };
  }

  private async executeAutomaticStart(
    manager: EntityManager,
    entry: CompetitionEntry,
    nextStage: Stage,
    startTime: Date,
  ): Promise<void> {
    const automaticStart = manager.create(TimingRecord, {
      tenant: entry.tenant,
      entry,
      stage: nextStage,
      recordType: TimeRecordType.START,
      recordedAt: startTime,
      isApproved: true,
      isAutomatic: true,
    });
    await manager.save(automaticStart);

    await manager.update(CompetitionEntry, entry.id, {
      status: ParticipantStatus.IN_RACE,
      currentStage: { id: nextStage.id },
    });

    console.log(
      `[Auto Start] LARGADA AUTOMÁTICA REGISTRADA: Dorsal ${entry.bibNumber} inició la Etapa ${nextStage.stageNumber} a las ${startTime.toISOString()}.`,
    );
  }

  async scanAndTriggerAutomaticStarts(): Promise<void> {
    // Guard: solo buscar binomios si hay al menos una competencia activa en el sistema.
    // Evita consumo innecesario de base de datos cuando la plataforma está ociosa.
    const activeCompetitionsCount = await this.dataSource.manager.count(
      Competition,
      {
        where: {
          status: CompetitionStatus.ACTIVE,
        },
      },
    );

    if (activeCompetitionsCount === 0) {
      return;
    }

    const restingEntries = await this.dataSource.manager.find(
      CompetitionEntry,
      {
        where: {
          status: ParticipantStatus.RESTING,
        },
        relations: [
          "competition",
          "competition.tenant",
          "tenant",
          "currentStage",
        ],
      },
    );

    for (const entry of restingEntries) {
      const eligibility = await this.validateDepartureEligibility(entry);
      if (
        eligibility.eligible &&
        eligibility.nextStage &&
        eligibility.scheduledDepartureTime
      ) {
        await this.dataSource.transaction(async (manager: EntityManager) => {
          const lockedEntry = await manager.findOne(CompetitionEntry, {
            where: { id: entry.id },
            lock: { mode: "pessimistic_write" },
          });
          if (!lockedEntry || lockedEntry.status !== ParticipantStatus.RESTING)
            return;

          const fullEntry = await manager.findOne(CompetitionEntry, {
            where: { id: lockedEntry.id },
            relations: [
              "competition",
              "competition.tenant",
              "tenant",
              "currentStage",
            ],
          });
          if (!fullEntry) return;

          const existingStart = await manager.findOne(TimingRecord, {
            where: {
              entry: { id: fullEntry.id },
              stage: { id: eligibility.nextStage.id },
              recordType: TimeRecordType.START,
              isVoid: false,
            },
          });
          if (!existingStart) {
            await this.executeAutomaticStart(
              manager,
              fullEntry,
              eligibility.nextStage,
              eligibility.scheduledDepartureTime,
            );
          } else {
            // Si ya existe la largada en la base de datos para la siguiente etapa, pero por algún motivo
            // el estado de la inscripción sigue como RESTING, corregimos el estado y la etapa actual.
            await manager.update(CompetitionEntry, fullEntry.id, {
              status: ParticipantStatus.IN_RACE,
              currentStage: { id: eligibility.nextStage.id },
            });
            console.log(
              `[Auto Start] CORRECCIÓN DE ESTADO: Dorsal ${fullEntry.bibNumber} ya tiene START en etapa ${eligibility.nextStage.stageNumber}, cambiando status a IN_RACE.`,
            );
          }
        });
      }
    }
  }
}
