import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Competition } from './entities/competition.entity';
import { Stage } from './entities/stage.entity';
import { Tenant } from '../tenants/entities/tenant.entity';
import { CompetitionType } from '../competition-types/entities/competition-type.entity';
import { CreateCompetitionDto } from './dto/create-competition.dto';
import { UpdateCompetitionDto } from './dto/update-competition.dto';
import { CompetitionStatus } from '@equuscronos/shared';

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
          tenant: tenant,
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

  async update(id: string, updateDto: UpdateCompetitionDto): Promise<Competition> {
    const competition = await this.compRepository.findOne({ 
      where: { id } 
    });
    if (!competition) {
      throw new NotFoundException(`Evento con ID ${id} no encontrado`);
    }
    //Verificación de integridad del pulso
if (updateDto.maxHeartRate !== undefined && updateDto.maxHeartRate !== competition.maxHeartRate) {
      // El pulso solo se puede tocar en fase de planificación
      if (competition.status !== CompetitionStatus.PLANNED) {
        throw new BadRequestException(
          `No se puede modificar el límite de pulsaciones. El evento se encuentra en estado: ${competition.status}`
        );
      }
    }
    // Fusionamos los cambios del DTO en la entidad existente
    Object.assign(competition, updateDto);

    return await this.compRepository.save(competition);
  }

  async remove(id: string): Promise<void> {
    const competition = await this.compRepository.findOne({ where: { id } });
    if (!competition) throw new NotFoundException('Competencia no encontrada.');

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. Obtener todos los IDs de inscripciones (competition_entries) para esta competencia
      const entries = await queryRunner.manager.query(
        `SELECT id FROM competition_entries WHERE competition_id = $1`,
        [id]
      );
      const entryIds = entries.map((e: any) => e.id);

      if (entryIds.length > 0) {
        // 2. Eliminar inspecciones veterinarias asociadas a los registros de tiempo de estas inscripciones
        await queryRunner.manager.query(
          `DELETE FROM vet_inspections WHERE timing_record_id IN (
            SELECT id FROM timing_records WHERE entry_id = ANY($1)
          )`,
          [entryIds]
        );

        // 3. Eliminar los registros de tiempo (timing_records)
        await queryRunner.manager.query(
          `DELETE FROM timing_records WHERE entry_id = ANY($1)`,
          [entryIds]
        );

        // 4. Eliminar los controles de peso (weight_controls)
        await queryRunner.manager.query(
          `DELETE FROM weight_controls WHERE entry_id = ANY($1)`,
          [entryIds]
        );

        // 5. Eliminar las penalizaciones (penalties)
        await queryRunner.manager.query(
          `DELETE FROM penalties WHERE entry_id = ANY($1)`,
          [entryIds]
        );

        // 6. Eliminar las inscripciones (competition_entries)
        await queryRunner.manager.query(
          `DELETE FROM competition_entries WHERE competition_id = $1`,
          [id]
        );
      }

      // 7. Eliminar las etapas (stages)
      await queryRunner.manager.query(
        `DELETE FROM stages WHERE competition_id = $1`,
        [id]
      );

      // 8. Eliminar la competencia principal (competitions)
      await queryRunner.manager.query(
        `DELETE FROM competitions WHERE id = $1`,
        [id]
      );

      await queryRunner.commitTransaction();
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw new BadRequestException(`No se pudo eliminar la competencia debido a dependencias: ${error.message}`);
    } finally {
      await queryRunner.release();
    }
  }
}
