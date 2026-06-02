import { Injectable, BadRequestException, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Competition } from './entities/competition.entity';
import { Stage } from './entities/stage.entity';
import { Tenant } from '../tenants/entities/tenant.entity';
import { CompetitionType } from '../competition-types/entities/competition-type.entity';
import { CreateCompetitionDto } from './dto/create-competition.dto';
import { UpdateCompetitionDto } from './dto/update-competition.dto';
import { CompetitionStatus, ParticipantStatus, TimeRecordType } from '@equuscronos/shared';
import { TimingRecord } from './entities/timing-record.entity';
import { CompetitionEntry } from '../competition-entries/entities/competition-entry.entity';

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

  /**
   * Da la largada oficial a la competencia bajo reglamento FEU.
   * NOTA DE SEGURIDAD / CUMPLIMIENTO:
   * La validación temporal se realiza de forma duplicada tanto en el Frontend (para guiar la UX y countdown de precisión)
   * como en el Backend (esta función, para garantizar la inmutabilidad y seguridad conforme al reglamento de la FEU).
   */
  async startCompetition(id: string): Promise<Competition> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. Buscar la competencia con relaciones requeridas
      const competition = await queryRunner.manager.findOne(Competition, {
        where: { id },
        relations: ['stages', 'tenant'],
      });

      if (!competition) {
        throw new NotFoundException('Competencia no encontrada.');
      }

      // 2. Idempotencia y validación de estado actual
      if (
        competition.status === CompetitionStatus.ACTIVE ||
        competition.status === CompetitionStatus.COMPLETED
      ) {
        throw new ConflictException(
          `La competencia ya se encuentra en estado ${competition.status}.`
        );
      }

      if (competition.status !== CompetitionStatus.PLANNED) {
        throw new BadRequestException(
          `La competencia no se puede largar. Estado actual: ${competition.status} (Requerido: PLANNED)`
        );
      }

      // 3. Validación Temporal (Reglamentaria FEU)
      // El servidor debe estar en el día de la competencia (competitionDate) y la hora debe ser igual o posterior a la programada (07:00:00).
      const now = new Date();

      // Formateador en zona horaria oficial uruguaya (America/Montevideo / GMT-3)
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/Montevideo',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      });

      const parts = formatter.formatToParts(now);
      const getVal = (type: string) => parts.find((p) => p.type === type).value;
      
      const serverTodayStr = `${getVal('year')}-${getVal('month')}-${getVal('day')}`;
      const serverHour = parseInt(getVal('hour'), 10);
      const serverMinute = parseInt(getVal('minute'), 10);

      // Formatear la fecha de la competencia
      const getLocalDateString = (d: any): string => {
        if (!d) return '';
        if (typeof d === 'string') return d.substring(0, 10);
        const year = d.getUTCFullYear();
        const month = String(d.getUTCMonth() + 1).padStart(2, '0');
        const day = String(d.getUTCDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      };

      const compDateStr = getLocalDateString(competition.competitionDate);

      // Validación de Fecha
      if (compDateStr !== serverTodayStr) {
        throw new BadRequestException(
          `LARGADA DENEGADA (Reglamento FEU): La carrera está programada para la fecha ${compDateStr}, pero hoy en Uruguay es ${serverTodayStr}. No se permiten largadas en fechas incorrectas.`
        );
      }

      // Validación de Hora de Largada Programada (Standard FEU: 07:00:00 local)
      const scheduledHour = 7;
      const scheduledMinute = 0;

      const currentMinutes = serverHour * 60 + serverMinute;
      const scheduledMinutes = scheduledHour * 60 + scheduledMinute;

      if (currentMinutes < scheduledMinutes) {
        throw new BadRequestException(
          `LARGADA DENEGADA (Reglamento FEU): Faltan minutos para la hora programada de largada (07:00:00). Hora actual del servidor en Uruguay: ${getVal('hour')}:${getVal('minute')}:${getVal('second')}.`
        );
      }

      // 4. Obtener la primera etapa
      if (!competition.stages || competition.stages.length === 0) {
        throw new BadRequestException(
          'La competencia no tiene etapas configuradas para registrar la largada.'
        );
      }

      const stages = [...competition.stages].sort((a, b) => a.stageNumber - b.stageNumber);
      const firstStage = stages[0];

      // 5. Prevención de Duplicados (Asegurar que no se creen múltiples START si se dispara la acción en paralelo)
      const existingStart = await queryRunner.manager.findOne(TimingRecord, {
        where: {
          stage: { id: firstStage.id },
          recordType: TimeRecordType.START,
        },
      });

      if (existingStart) {
        throw new ConflictException(
          'La largada oficial ya ha sido registrada previamente para esta competencia.'
        );
      }

      // 6. Obtener inscripciones activas (binomios en carrera / habilitados)
      const entries = await queryRunner.manager.find(CompetitionEntry, {
        where: { competition: { id: competition.id } },
      });

      // 7. Actualizar estado de la carrera a ACTIVE
      competition.status = CompetitionStatus.ACTIVE;
      await queryRunner.manager.save(Competition, competition);

      // 8. Crear registros oficiales TimingRecord de tipo START para todos los binomios activos
      const startRecords = entries
        .filter((entry) => entry.status === ParticipantStatus.IN_RACE)
        .map((entry) => {
          return queryRunner.manager.create(TimingRecord, {
            tenant: competition.tenant,
            entry: entry,
            stage: firstStage,
            recordType: TimeRecordType.START,
            recordedAt: now,
            isApproved: true,
          });
        });

      if (startRecords.length > 0) {
        await queryRunner.manager.save(TimingRecord, startRecords);
      }

      await queryRunner.commitTransaction();

      // Retornar la competencia actualizada
      return await this.findOne(competition.id);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      if (
        error instanceof NotFoundException ||
        error instanceof ConflictException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      throw new BadRequestException(`Error al dar la largada oficial: ${error.message}`);
    } finally {
      await queryRunner.release();
    }
  }
}
