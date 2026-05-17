import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { WeightControl } from './entities/weight-control.entity';
import { CreateWeightControlDto } from './dto/create-weight-control.dto';
import { CompetitionEntry } from '../competition-entries/entities/competition-entry.entity';
import { Stage } from '../competitions/entities/stage.entity';
import { ParticipantStatus } from '@equuscronos/shared';

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
      relations: ['competition', 'competition.competitionType']
    });
    if (!entry) throw new NotFoundException('Inscripción no encontrada.');

    let stage = null;
    if (dto.stageId) {
      stage = await this.stageRepo.findOne({ where: { id: dto.stageId } });
      if (!stage) throw new NotFoundException('Etapa no encontrada.');
    }

    const rules = entry.competition.competitionType.defaultRules || {};
    const baseMinWeight = rules.min_weight_kg || 85;

    let allowedWeight = baseMinWeight;
    if (dto.controlType !== 'INITIAL') {
      allowedWeight = baseMinWeight - 1; // 84kg permitidos en etapas/llegada
    }

    // Garantizamos atomicidad al registrar el pesaje y descalificar si no cumple el peso mínimo para evitar inconsistencias de estado.
    return await this.dataSource.transaction(async (manager) => {
      const newControl = manager.create(WeightControl, {
        entry,
        stage,
        weightRecorded: dto.weightRecorded,
        controlType: dto.controlType,
        // recordedBy se inyectará cuando integremos el token JWT del usuario
      });

      const savedControl = await manager.save(newControl);

      if (dto.weightRecorded < allowedWeight) {
        const reason = `Falta de peso en control ${dto.controlType}: Registró ${dto.weightRecorded}kg (Mínimo: ${allowedWeight}kg)`;
        
        await manager.update(CompetitionEntry, entry.id, {
          status: ParticipantStatus.DQ,
        });

        console.log(`[EquusCronos] Binomio ${entry.bibNumber} DESCALIFICADO por PESO dentro de transacción: ${reason}`);
      }

      return savedControl;
    });
  }
}
