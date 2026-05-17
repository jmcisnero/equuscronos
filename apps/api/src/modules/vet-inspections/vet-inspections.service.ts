import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { VetInspection } from './entities/vet-inspection.entity'; 
import { TimingRecord } from '../competitions/entities/timing-record.entity';
import { CreateVetInspectionDto } from './dto/create-vet-inspection.dto';
import { TimeRecordType, ParticipantStatus, EliminationCode, MotricityStatus } from '@equuscronos/shared';
import { CompetitionEntry } from '../competition-entries/entities/competition-entry.entity';

@Injectable()
export class VetInspectionsService {
  constructor(
    @InjectRepository(VetInspection)
    private readonly vetRepo: Repository<VetInspection>,
    @InjectRepository(TimingRecord)
    private readonly timingRepo: Repository<TimingRecord>,
    private readonly dataSource: DataSource,
  ) {}

  async create(dto: CreateVetInspectionDto): Promise<VetInspection> {
    const timingRecord = await this.timingRepo.findOne({ 
      where: { id: dto.timingRecordId },
      relations: ['entry', 'entry.competition']
    });
    
    if (!timingRecord) throw new NotFoundException('Registro de tiempo no encontrado.');
    if (timingRecord.recordType !== TimeRecordType.VET_IN) {
      throw new BadRequestException('La inspección veterinaria solo puede asociarse a un tiempo tipo VET_IN.');
    }

    const entry = timingRecord.entry;
    const maxHeartRate = entry.competition.maxHeartRate || 65;

    // Garantizamos atomicidad al registrar control veterinario y descalificar por pulso/trote para evitar errores en pista.
    return await this.dataSource.transaction(async (manager) => {
      const newInspection = manager.create(VetInspection, {
        timingRecord,
        heartRate: dto.heartRate,
        temperature: dto.temperature,
        motricity: dto.motricity,
        metabolic: dto.metabolic,
        notes: dto.notes,
      });

      const savedInspection = await manager.save(newInspection);

      let shouldDisqualify = false;
      let reason = '';
      let eliminationCode: EliminationCode = null;

      if (dto.heartRate > maxHeartRate) {
        shouldDisqualify = true;
        reason = `Pulso excedido: ${dto.heartRate} bpm (Máx: ${maxHeartRate})`;
        eliminationCode = EliminationCode.METABOLIC;
      }

      if (dto.motricity === MotricityStatus.NOT_APTO) {
        shouldDisqualify = true;
        reason = 'No apto en prueba de trote / Claudicación detectada.';
        eliminationCode = EliminationCode.GAIT;
      }

      if (shouldDisqualify) {
        await manager.update(CompetitionEntry, entry.id, {
          status: ParticipantStatus.DQ,
        });

        await manager.update(TimingRecord, timingRecord.id, {
          isApproved: false,
          eliminationType: eliminationCode,
          eliminationReason: reason,
        });
        
        console.log(`[EquusCronos] Binomio ${entry.bibNumber} descalificado automáticamente dentro de transacción: ${reason}`);
      }

      return savedInspection;
    });
  }
}
