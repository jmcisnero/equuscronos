import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { VetInspection } from '../competitions/entities/vet-inspection.entity'; // Apunta a la entidad existente
import { TimingRecord } from '../competitions/entities/timing-record.entity';
import { CreateVetInspectionDto } from './dto/create-vet-inspection.dto';
import { TimeRecordType } from '@equuscronos/shared';

@Injectable()
export class VetInspectionsService {
  constructor(
    @InjectRepository(VetInspection)
    private readonly vetRepo: Repository<VetInspection>,
    @InjectRepository(TimingRecord)
    private readonly timingRepo: Repository<TimingRecord>,
  ) {}

  async create(dto: CreateVetInspectionDto): Promise<VetInspection> {
    const timingRecord = await this.timingRepo.findOne({ where: { id: dto.timingRecordId } });
    
    if (!timingRecord) throw new NotFoundException('Registro de tiempo no encontrado.');
    if (timingRecord.recordType !== TimeRecordType.VET_IN) {
      throw new BadRequestException('La inspección veterinaria solo puede asociarse a un tiempo tipo VET_IN.');
    }

    const newInspection = this.vetRepo.create({
      timingRecord,
      heartRate: dto.heartRate,
      temperature: dto.temperature,
      motricity: dto.motricity,
      metabolic: dto.metabolic,
      notes: dto.notes,
    });

    // Al guardar, el `VetInspectionSubscriber` (centinela) se activará automáticamente.
    return await this.vetRepo.save(newInspection);
  }
}
