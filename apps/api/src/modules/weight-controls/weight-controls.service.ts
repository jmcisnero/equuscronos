import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WeightControl } from './entities/weight-control.entity';
import { CreateWeightControlDto } from './dto/create-weight-control.dto';
import { CompetitionEntry } from '../competition-entries/entities/competition-entry.entity';
import { Stage } from '../competitions/entities/stage.entity';

@Injectable()
export class WeightControlsService {
  constructor(
    @InjectRepository(WeightControl)
    private readonly weightRepo: Repository<WeightControl>,
    @InjectRepository(CompetitionEntry)
    private readonly entryRepo: Repository<CompetitionEntry>,
    @InjectRepository(Stage)
    private readonly stageRepo: Repository<Stage>,
  ) {}

  async create(dto: CreateWeightControlDto): Promise<WeightControl> {
    const entry = await this.entryRepo.findOne({ where: { id: dto.entryId } });
    if (!entry) throw new NotFoundException('Inscripción no encontrada.');

    let stage = null;
    if (dto.stageId) {
      stage = await this.stageRepo.findOne({ where: { id: dto.stageId } });
      if (!stage) throw new NotFoundException('Etapa no encontrada.');
    }

    const newControl = this.weightRepo.create({
      entry,
      stage,
      weightRecorded: dto.weightRecorded,
      controlType: dto.controlType,
      // recordedBy se inyectará cuando integremos el token JWT del usuario
    });

    // Al guardar esto, el `WeightControlSubscriber` (centinela) se disparará automáticamente.
    return await this.weightRepo.save(newControl);
  }
}
