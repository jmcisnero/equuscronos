import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CompetitionEntry } from './entities/competition-entry.entity';
import { CreateCompetitionEntryDto } from './dto/create-competition-entry.dto';
import { UpdateCompetitionEntryDto } from './dto/update-competition-entry.dto';
import { Competition } from '../competitions/entities/competition.entity';
import { Rider } from '../riders/entities/rider.entity';
import { Horse } from '../horses/entities/horse.entity';
import { Tenant } from '../tenants/entities/tenant.entity';

@Injectable()
export class CompetitionEntriesService {
  constructor(
    @InjectRepository(CompetitionEntry) private readonly entryRepo: Repository<CompetitionEntry>,
    @InjectRepository(Competition) private readonly compRepo: Repository<Competition>,
    @InjectRepository(Rider) private readonly riderRepo: Repository<Rider>,
    @InjectRepository(Horse) private readonly horseRepo: Repository<Horse>,
    @InjectRepository(Tenant) private readonly tenantRepo: Repository<Tenant>,
  ) {}

  async create(dto: CreateCompetitionEntryDto): Promise<CompetitionEntry> {
    // 1. Validar que la Competencia, Jinete y Caballo existan
    const competition = await this.compRepo.findOne({ where: { id: dto.competitionId } });
    if (!competition) throw new NotFoundException('Competencia no encontrada.');

    const rider = await this.riderRepo.findOne({ where: { id: dto.riderId } });
    if (!rider) throw new NotFoundException('Jinete no encontrado.');

    const horse = await this.horseRepo.findOne({ where: { id: dto.horseId } });
    if (!horse) throw new NotFoundException('Caballo no encontrado.');

    let representedTenant = null;
    if (dto.representedTenantId) {
      representedTenant = await this.tenantRepo.findOne({ where: { id: dto.representedTenantId } });
      if (!representedTenant) throw new NotFoundException('Club representado no encontrado.');
    }

    // 2. Regla de Negocio: Un dorsal no se puede repetir en la misma carrera
    const existingBib = await this.entryRepo.findOne({
      where: { competition: { id: dto.competitionId }, bibNumber: dto.bibNumber }
    });
    if (existingBib) throw new ConflictException(`El dorsal #${dto.bibNumber} ya está en uso en esta carrera.`);

    // 3. Regla de Negocio: Un mismo binomio (Jinete+Caballo) no puede inscribirse dos veces
    const existingEntry = await this.entryRepo.findOne({
      where: { competition: { id: dto.competitionId }, rider: { id: dto.riderId }, horse: { id: dto.horseId } }
    });
    if (existingEntry) throw new ConflictException('Este binomio ya está inscripto en esta carrera.');

    // 4. Crear inscripción
    const newEntry = this.entryRepo.create({
      ...dto,
      competition,
      rider,
      horse,
      representedTenant
    });

    return await this.entryRepo.save(newEntry);
  }

  async findAllByCompetition(competitionId: string): Promise<CompetitionEntry[]> {
    return await this.entryRepo.find({
      where: { competition: { id: competitionId } },
      relations: ['rider', 'horse', 'representedTenant', 'currentStage'],
      order: { bibNumber: 'ASC' }
    });
  }

  async findOne(id: string): Promise<CompetitionEntry> {
    const entry = await this.entryRepo.findOne({
      where: { id },
      relations: ['competition', 'rider', 'horse', 'representedTenant', 'currentStage']
    });
    if (!entry) throw new NotFoundException('Inscripción no encontrada.');
    return entry;
  }

  async update(id: string, dto: UpdateCompetitionEntryDto): Promise<CompetitionEntry> {
    const entry = await this.findOne(id);
    
    // Si intentan cambiar el dorsal, validar que no choque con otro
    if (dto.bibNumber && dto.bibNumber !== entry.bibNumber) {
      const existingBib = await this.entryRepo.findOne({
        where: { competition: { id: entry.competition.id }, bibNumber: dto.bibNumber }
      });
      if (existingBib) throw new ConflictException(`El dorsal #${dto.bibNumber} ya está en uso.`);
    }

    const updatedEntry = Object.assign(entry, dto);
    return await this.entryRepo.save(updatedEntry);
  }

  async remove(id: string): Promise<void> {
    const entry = await this.findOne(id);
    await this.entryRepo.remove(entry);
  }
}
