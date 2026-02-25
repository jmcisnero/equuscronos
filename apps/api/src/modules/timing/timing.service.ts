import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { TimingRecord } from '../competitions/entities/timing-record.entity';
import { CompetitionEntry } from '../competitions/entities/competition-entry.entity';
import { Stage } from '../competitions/entities/stage.entity';
import { CreateTimingRecordDto } from './dto/create-timing.dto';
import { ParticipantStatus, TimeRecordType } from '@equuscronos/shared';

@Injectable()
export class TimingService {
  constructor(
    @InjectRepository(TimingRecord)
    private readonly timingRepository: Repository<TimingRecord>,
    @InjectRepository(CompetitionEntry)
    private readonly entryRepository: Repository<CompetitionEntry>,
    @InjectRepository(Stage)
    private readonly stageRepository: Repository<Stage>,
    private readonly dataSource: DataSource,
  ) {}

  async processRapidFireRecord(dto: CreateTimingRecordDto): Promise<TimingRecord> {
    
    // 1. Resolución Dinámica de la Inscripción (Soporta Manual o Chip)
    const queryBuilder = this.entryRepository.createQueryBuilder('entry')
      .leftJoinAndSelect('entry.horse', 'horse')
      .where('entry.competition_id = :compId', { compId: dto.competitionId });

    if (dto.bibNumber) {
      queryBuilder.andWhere('entry.bib_number = :bibNumber', { bibNumber: dto.bibNumber });
    } else if (dto.chipId) {
      queryBuilder.andWhere('horse.chip_id = :chipId', { chipId: dto.chipId });
    } else {
      throw new BadRequestException('Debe proporcionar un dorsal o un chip RFID válido.');
    }

    const entry = await queryBuilder.getOne();

    if (!entry) {
      throw new NotFoundException(`Binomio no encontrado para los datos proporcionados.`);
    }

    if (entry.status === ParticipantStatus.DQ || entry.status === ParticipantStatus.DNF) {
      throw new BadRequestException(`El binomio seleccionado ya se encuentra fuera de competencia.`);
    }

    // 2. Validar Etapa
    const stage = await this.stageRepository.findOne({ where: { id: dto.stageId } });
    if (!stage) {
      throw new NotFoundException('La etapa especificada no existe.');
    }

    // 3. Crear el registro con precisión de milisegundos generada en el dispositivo móvil/antena
    const newRecord = this.timingRepository.create({
      entry: entry,
      stage: stage,
      recordType: dto.recordType,
      recordedAt: new Date(dto.recordedAt), 
      heartRate: dto.heartRate,
      isApproved: dto.isApproved ?? true,
      eliminationType: dto.eliminationType,
      eliminationReason: dto.eliminationReason,
    });

    // 4. Persistencia Segura (Transacción)
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const savedRecord = await queryRunner.manager.save(TimingRecord, newRecord);

      // Lógica de descalificación veterinaria
      if (dto.recordType === TimeRecordType.VET_IN && dto.isApproved === false) {
        entry.status = ParticipantStatus.DQ;
        await queryRunner.manager.save(CompetitionEntry, entry);
      }

      await queryRunner.commitTransaction();
      return savedRecord;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }
}
