import { Injectable, NotFoundException, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { TimingRecord } from '../competitions/entities/timing-record.entity';
import { CompetitionEntry } from '../competition-entries/entities/competition-entry.entity';
import { Stage } from '../competitions/entities/stage.entity';
import { CreateTimingRecordDto } from './dto/create-timing.dto';
import { TimeRecordType, ParticipantStatus } from '@equuscronos/shared';
import { TimeCalculationService } from './services/time-calculation.service';

@Injectable()
export class TimingService {
  constructor(
    // Inyectamos DataSource para controlar transacciones seguras
    private readonly dataSource: DataSource,
    private readonly timeCalcService: TimeCalculationService,
  ) {}

  /**
   * Registra un hito de cronometraje en pista garantizando integridad ACID
   * y bloqueos contra concurrencia de antenas RFID.
   */
  async create(dto: CreateTimingRecordDto): Promise<TimingRecord> {
    // 1. Validación de Entrada (Failsafe)
    if (!dto.bibNumber && !dto.chipId) {
      throw new BadRequestException('Se requiere Dorsal (bibNumber) o Chip RFID (chipId) para registrar el tiempo.');
    }

    // El bloqueo pesimista y la validación de 60 minutos garantizan la integridad de la carrera y evitan sanciones de la FEU.
    // TRANSACCIÓN SEGURA: Todo se ejecuta o nada se guarda
    return await this.dataSource.transaction(async (manager: EntityManager) => {
      
      // 2. Búsqueda con Bloqueo Pesimista (Evita duplicidad si 2 jueces envían el mismo dato al mismo tiempo)
      // 2. Búsqueda con Bloqueo Pesimista (Evita duplicidad si 2 jueces envían el mismo dato al mismo tiempo)
      // Primero encontramos el ID del binomio sin bloquear (permite joins)
      const entryToLock = await manager.findOne(CompetitionEntry, {
        where: dto.chipId 
          ? { competition: { id: dto.competitionId }, horse: { chipId: dto.chipId } }
          : { competition: { id: dto.competitionId }, bibNumber: dto.bibNumber },
      });

      if (!entryToLock) {
        throw new NotFoundException(`Binomio no encontrado en la competencia activa.`);
      }

      // Ahora bloqueamos la fila específica por su ID primario (sin joins, evitando error de Postgres FOR UPDATE)
      const lockedEntry = await manager.findOne(CompetitionEntry, {
        where: { id: entryToLock.id },
        lock: { mode: 'pessimistic_write' },
      });

      if (!lockedEntry) {
        throw new NotFoundException(`Binomio no encontrado en la competencia activa.`);
      }

      // Cargamos las relaciones asociadas bajo la seguridad de la transacción bloqueada
      const entry = await manager.findOne(CompetitionEntry, {
        where: { id: lockedEntry.id },
        relations: ['competition', 'horse', 'rider', 'tenant'],
      });

      if (!entry) {
        throw new NotFoundException(`Binomio no encontrado en la competencia activa.`);
      }

      // 3. Validación de Estado del Competidor
      const invalidStatuses = [
        ParticipantStatus.DQ, 
        ParticipantStatus.DNF, 
        ParticipantStatus.WD
      ];
      
      if (invalidStatuses.includes(entry.status)) {
        throw new BadRequestException(`Acción rechazada: El dorsal ${entry.bibNumber} está fuera de competencia (${entry.status}).`);
      }

      // 4. Validación de Secuencia Lógica FEU (Máquina de Estados)
      const existingRecords = await manager.find(TimingRecord, {
        where: { entry: { id: entry.id }, stage: { id: dto.stageId } },
        relations: ['vetInspection'],
      });

      this.validateLogicalSequence(dto.recordType, existingRecords);
 
      // 5. Persistencia del Tiempo 
      try {
        // Obtenemos la etapa actual completa para saber su neutralización
        const stage = await manager.findOne(Stage, { where: { id: dto.stageId } });
        if (!stage) throw new NotFoundException('Etapa no encontrada.');
 
        let scheduledDepartureTime = null;
        // Si es LLEGADA, calculamos la hora en que debe largar la siguiente etapa garantizando la neutralización (Art. 28)
        if (dto.recordType === TimeRecordType.ARRIVAL) {
          scheduledDepartureTime = this.timeCalcService.calculateNextDepartureTime(
            new Date(dto.recordedAt), 
            stage
          );
        }        
        
        const newRecord = manager.create(TimingRecord, {
          tenant: entry.tenant,
          entry,
          stage: { id: dto.stageId },
          recordType: dto.recordType,
          recordedAt: new Date(dto.recordedAt),
          isApproved: dto.isApproved ?? true,
          scheduledDepartureTime: scheduledDepartureTime, // AHORA SÍ GUARDAMOS EL CÁLCULO
        });
 
        const savedRecord = await manager.save(newRecord);
 
        // 6. Sincronización del Estado del Competidor
        await this.syncEntryState(manager, entry, dto);
 
        return savedRecord;
 
      } catch (error) {
        throw new InternalServerErrorException(`Error crítico al persistir el tiempo: ${error.message}`);
      }
    });
  }
 
  /**
   * Asegura que las leyes de la física y el Reglamento FEU no se rompan en el software.
   */
  private validateLogicalSequence(newRecordType: TimeRecordType, existingRecords: TimingRecord[]): void {
    const hasStart = existingRecords.some(r => r.recordType === TimeRecordType.START);
    const hasArrival = existingRecords.some(r => r.recordType === TimeRecordType.ARRIVAL);
 
    // Regla 1: Un evento no puede ocurrir dos veces en la misma etapa, salvo VET_IN si requiere rechequeo
    if (existingRecords.some(r => r.recordType === newRecordType)) {
      if (newRecordType === TimeRecordType.VET_IN) {
        const vetInRecords = existingRecords.filter(r => r.recordType === TimeRecordType.VET_IN);
        if (vetInRecords.length >= 2) {
          throw new BadRequestException('Máximo de 2 intentos de inspección veterinaria (VET_IN) permitidos por etapa.');
        }
        const firstVetIn = vetInRecords[0];
        if (!firstVetIn.vetInspection || !firstVetIn.vetInspection.isRecheckRequired) {
          throw new BadRequestException('No se puede registrar un segundo intento de VET_IN si el primero no requiere rechequeo.');
        }
      } else {
        throw new BadRequestException(`Dato duplicado: El hito [${newRecordType}] ya fue registrado en esta etapa para este binomio.`);
      }
    }
 
    // Regla 2: El orden causal (Línea de Tiempo FEU)
    if (newRecordType === TimeRecordType.ARRIVAL && !hasStart) {
      throw new BadRequestException('Secuencia inválida: No se puede registrar LLEGADA (ARRIVAL) sin una LARGADA (START) previa.');
    }
    
    if (newRecordType === TimeRecordType.VET_IN && !hasArrival) {
      throw new BadRequestException('Secuencia inválida: No se puede registrar ingreso veterinario (VET_IN) sin haber cruzado la meta (ARRIVAL).');
    }
  }

  /**
   * Actualiza el estado principal del participante basándose en el hito temporal.
   */
  private async syncEntryState(manager: EntityManager, entry: CompetitionEntry, dto: CreateTimingRecordDto): Promise<void> {
    let newStatus = entry.status;

    if (dto.recordType === TimeRecordType.START) {
      newStatus = ParticipantStatus.IN_RACE;
    } else if (dto.recordType === TimeRecordType.VET_IN) {
      newStatus = ParticipantStatus.VET_CHECK;
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
  async void(id: string, voidReason: string): Promise<TimingRecord> {
    return await this.dataSource.transaction(async (manager: EntityManager) => {
      const record = await manager.findOne(TimingRecord, {
        where: { id },
        relations: ['entry', 'stage', 'tenant'],
        lock: { mode: 'pessimistic_write' },
      });

      if (!record) {
        throw new NotFoundException(`Registro de tiempo con ID ${id} no encontrado.`);
      }

      if (record.isVoid) {
        throw new BadRequestException('El registro ya ha sido anulado.');
      }

      record.isVoid = true;
      record.voidReason = voidReason;

      const savedRecord = await manager.save(record);

      // Rollback participant status if necessary
      const activeRecords = await manager.find(TimingRecord, {
        where: { entry: { id: record.entry.id }, isVoid: false },
        order: { recordedAt: 'DESC' },
      });

      const latestRecord = activeRecords.length > 0 ? activeRecords[0] : null;
      const targetStatus = this.getStatusForLatestRecord(latestRecord ? latestRecord.recordType : null);

      await manager.update(CompetitionEntry, record.entry.id, {
        status: targetStatus,
      });

      console.log(`[Void] Record ${id} voided. Competitor status rolled back to ${targetStatus}`);

      return savedRecord;
    });
  }

  private getStatusForLatestRecord(recordType: TimeRecordType | null): ParticipantStatus {
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
  async updateRecord(id: string, recordedAt: string): Promise<TimingRecord> {
    return await this.dataSource.transaction(async (manager: EntityManager) => {
      const record = await manager.findOne(TimingRecord, {
        where: { id },
        relations: ['entry', 'stage', 'tenant'],
        lock: { mode: 'pessimistic_write' },
      });

      if (!record) {
        throw new NotFoundException(`Registro de tiempo con ID ${id} no encontrado.`);
      }

      if (record.isVoid) {
        throw new BadRequestException('No se puede modificar un registro anulado.');
      }

      // Validar: "siempre que sea dentro de la misma etapa y antes de la presentación olímpica"
      if (record.recordType === TimeRecordType.ARRIVAL) {
        const hasVetIn = await manager.findOne(TimingRecord, {
          where: { entry: { id: record.entry.id }, stage: { id: record.stage.id }, recordType: TimeRecordType.VET_IN, isVoid: false },
        });
        if (hasVetIn) {
          throw new BadRequestException('No se puede modificar el registro de llegada (ARRIVAL) porque el binomio ya ingresó a la mesa veterinaria (VET_IN).');
        }
      } else if (record.recordType === TimeRecordType.START) {
        const hasArrival = await manager.findOne(TimingRecord, {
          where: { entry: { id: record.entry.id }, stage: { id: record.stage.id }, recordType: TimeRecordType.ARRIVAL, isVoid: false },
        });
        if (hasArrival) {
          throw new BadRequestException('No se puede modificar el registro de largada (START) porque el binomio ya registró su llegada (ARRIVAL).');
        }
      }

      record.recordedAt = new Date(recordedAt);

      // Recalcular scheduledDepartureTime si el registro es una LLEGADA (ARRIVAL)
      if (record.recordType === TimeRecordType.ARRIVAL) {
        const stage = await manager.findOne(Stage, { where: { id: record.stage.id } });
        if (stage) {
          record.scheduledDepartureTime = this.timeCalcService.calculateNextDepartureTime(
            record.recordedAt,
            stage
          );
        }
      }

      const savedRecord = await manager.save(record);
      console.log(`[Update] Record ${id} updated with new timestamp ${recordedAt}`);

      return savedRecord;
    });
  }
}

