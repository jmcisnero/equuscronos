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
      const entry = await manager.findOne(CompetitionEntry, {
        where: dto.chipId 
          ? { competition: { id: dto.competitionId }, horse: { chipId: dto.chipId } }
          : { competition: { id: dto.competitionId }, bibNumber: dto.bibNumber },
        relations: ['competition', 'horse', 'rider'],
        lock: { mode: 'pessimistic_write' },
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

    // Regla 1: Un evento no puede ocurrir dos veces en la misma etapa
    if (existingRecords.some(r => r.recordType === newRecordType)) {
      throw new BadRequestException(`Dato duplicado: El hito [${newRecordType}] ya fue registrado en esta etapa para este binomio.`);
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
}
