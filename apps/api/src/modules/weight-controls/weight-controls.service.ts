import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { WeightControl } from './entities/weight-control.entity';
import { CreateWeightControlDto } from './dto/create-weight-control.dto';
import { CompetitionEntry } from '../competition-entries/entities/competition-entry.entity';
import { Stage } from '../competitions/entities/stage.entity';
import { ParticipantStatus, AuditAction } from '@equuscronos/shared';
import { AuditLog } from '../audit/entities/audit-log.entity';

@Injectable()
export class WeightControlsService {
  constructor(
    @InjectRepository(WeightControl)
    private readonly weightRepo: Repository<WeightControl>,
    @InjectRepository(CompetitionEntry)
    private readonly entryRepo: Repository<CompetitionEntry>,
    @InjectRepository(Stage)
    private readonly stageRepo: Repository<Stage>,
    private readonly dataSource: DataSource,
  ) {}

  async create(dto: CreateWeightControlDto): Promise<WeightControl> {
    const entry = await this.entryRepo.findOne({ 
      where: { id: dto.entryId },
      relations: ['competition', 'competition.competitionType', 'tenant']
    });
    if (!entry) throw new NotFoundException('Inscripción no encontrada.');

    // 1. Vincular y validar controlType y stageId
    if (dto.controlType === 'INITIAL') {
      // Para pesajes de tipo INITIAL, no debe requerirse stageId y se limpia
      dto.stageId = undefined;
    } else if (dto.controlType === 'NEUTRALIZATION' || dto.controlType === 'ARRIVAL') {
      // Para NEUTRALIZATION y ARRIVAL, el stageId es obligatorio
      if (!dto.stageId) {
        throw new BadRequestException(
          `El stageId es requerido para controles de tipo ${dto.controlType}.`
        );
      }
    } else {
      throw new BadRequestException(`Tipo de control '${dto.controlType}' no válido.`);
    }

    let stage = null;
    if (dto.stageId) {
      stage = await this.stageRepo.findOne({ where: { id: dto.stageId } });
      if (!stage) throw new NotFoundException('Etapa no encontrada.');
    }

    // 2. Buscar el registro previo de tipo INITIAL para ese entryId
    const initialControl = await this.weightRepo.findOne({
      where: {
        entry: { id: dto.entryId },
        controlType: 'INITIAL',
      },
      order: { recordedAt: 'DESC' },
    });

    // 3. Lógica de rechazo si no existe pesaje de "Marcación" (INITIAL) previo para controles posteriores
    if (dto.controlType === 'NEUTRALIZATION' || dto.controlType === 'ARRIVAL') {
      if (!initialControl) {
        throw new BadRequestException(
          `No se puede registrar un control de tipo ${dto.controlType} sin un pesaje INITIAL (Marcación) previo.`
        );
      }
    }

    const rules = entry.competition.competitionType.defaultRules || {};
    const baseMinWeight = Number(rules.min_weight_kg || rules.min_weight || 85);

    // Garantizamos atomicidad al registrar el pesaje, descalificar si corresponde y registrar en AuditLog
    return await this.dataSource.transaction(async (manager) => {
      const newControl = manager.create(WeightControl, {
        entry,
        stage,
        weightRecorded: dto.weightRecorded,
        controlType: dto.controlType,
        // recordedBy se inyectará cuando integremos el token JWT del usuario
      });

      const savedControl = await manager.save(newControl);

      // A) Para INITIAL, validar contra el peso mínimo base (e.g. 85kg)
      if (dto.controlType === 'INITIAL') {
        if (dto.weightRecorded < baseMinWeight) {
          const reason = `Falta de peso mínimo en control INITIAL: Registró ${dto.weightRecorded} kg (Mínimo requerido: ${baseMinWeight} kg)`;
          
          await manager.update(CompetitionEntry, entry.id, {
            status: ParticipantStatus.DQ,
          });

          console.log(`[EquusCronos] Binomio ${entry.bibNumber} DESCALIFICADO por PESO en marcación inicial: ${reason}`);

          // Registrar en AuditLog
          const auditLog = manager.create(AuditLog, {
            tenant: entry.tenant || entry.competition?.tenant,
            action: AuditAction.SECURITY_ALERT,
            entityName: 'weight_controls',
            entityId: savedControl.id,
            newData: {
              message: reason,
              entryId: entry.id,
              bibNumber: entry.bibNumber,
              minWeightRequired: baseMinWeight,
              recordedWeight: dto.weightRecorded,
            },
          });
          await manager.save(AuditLog, auditLog);
        }
      }

      // B) Para controles posteriores a INITIAL (NEUTRALIZATION, ARRIVAL)
      if (dto.controlType !== 'INITIAL' && initialControl) {
        const diff = Number(initialControl.weightRecorded) - dto.weightRecorded;
        
        // Si es > 1 kg (según Art. 20), el sistema debe descalificar (DQ) y registrar en AuditLog
        if (diff > 1.0) {
          const reason = `Descalificación por incumplimiento de peso (Art. 20) en control ${dto.controlType}: Peso inicial de marcación fue ${initialControl.weightRecorded} kg y en control actual se registró ${dto.weightRecorded} kg (pérdida de ${diff.toFixed(2)} kg, superando el límite reglamentario de 1.0 kg).`;

          await manager.update(CompetitionEntry, entry.id, {
            status: ParticipantStatus.DQ,
          });

          console.log(`[EquusCronos] Binomio ${entry.bibNumber} DESCALIFICADO por PESO dentro de transacción: ${reason}`);

          // Registrar en AuditLog detallando el incumplimiento de peso
          const auditLog = manager.create(AuditLog, {
            tenant: entry.tenant || entry.competition?.tenant,
            action: AuditAction.SECURITY_ALERT,
            entityName: 'weight_controls',
            entityId: savedControl.id,
            newData: {
              message: reason,
              entryId: entry.id,
              bibNumber: entry.bibNumber,
              initialWeight: initialControl.weightRecorded,
              recordedWeight: dto.weightRecorded,
              difference: diff,
            },
          });
          await manager.save(AuditLog, auditLog);
        }
      }

      return savedControl;
    });
  }
}
