import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Competition } from './entities/competition.entity';
import { Stage } from './entities/stage.entity';
import { Tenant } from '../tenants/entities/tenant.entity';
import { CompetitionType } from './entities/competition-type.entity';
import { CreateCompetitionDto } from './dto/create-competition.dto';

@Injectable()
export class CompetitionsService {
  constructor(
    @InjectRepository(Competition)
    private readonly compRepository: Repository<Competition>,
    private readonly dataSource: DataSource,
  ) {}

  async createCompetitionWithStages(dto: CreateCompetitionDto): Promise<Competition> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. Validar existencias (Tenant y Tipo de Regla)
      const tenant = await queryRunner.manager.findOne(Tenant, { where: { id: dto.tenantId } });
      if (!tenant) throw new NotFoundException('Organización (Tenant) no encontrada.');

      const compType = await queryRunner.manager.findOne(CompetitionType, { where: { id: dto.competitionTypeId } });
      if (!compType) throw new NotFoundException('Tipo de competencia no encontrado.');

      // 2. Crear la entidad principal (Competencia)
      const competition = this.compRepository.create({
        tenant,
        competitionType: compType,
        name: dto.name,
        competitionDate: new Date(dto.competitionDate),
        location: dto.location,
        isFederated: dto.isFederated ?? false,
        status: dto.status,
      });

      const savedCompetition = await queryRunner.manager.save(Competition, competition);

      // 3. Crear y asociar las Etapas
      const stagesToSave = dto.stages.map(stageDto => {
        return queryRunner.manager.create(Stage, {
          competition: savedCompetition,
          stageNumber: stageDto.stageNumber,
          distanceKm: stageDto.distanceKm,
          neutralizationMinutes: stageDto.neutralizationMinutes ?? 0,
        });
      });

      await queryRunner.manager.save(Stage, stagesToSave);

      // 4. Confirmar transacción
      await queryRunner.commitTransaction();
      
      // Retornar la competencia con sus etapas incluidas
      return this.findOne(savedCompetition.id); 
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw new BadRequestException(`Error al crear la competencia: ${error.message}`);
    } finally {
      await queryRunner.release();
    }
  }

  async findOne(id: string): Promise<Competition> {
    const comp = await this.compRepository.findOne({
      where: { id },
      relations: ['stages', 'tenant', 'competitionType'], // Trae los datos anidados
    });
    if (!comp) throw new NotFoundException('Competencia no encontrada.');
    return comp;
  }

  async findAll(): Promise<Competition[]> {
    return this.compRepository.find({
      order: { competitionDate: 'DESC' },
      relations: ['stages'],
    });
  }
}
