import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CompetitionType } from './entities/competition-type.entity';
import { CreateCompetitionTypeDto } from './dto/create-competition-type.dto';
import { UpdateCompetitionTypeDto } from './dto/update-competition-type.dto';

@Injectable()
export class CompetitionTypesService {
  constructor(
    @InjectRepository(CompetitionType)
    private readonly compTypeRepository: Repository<CompetitionType>,
  ) {}

  async create(createCompetitionTypeDto: CreateCompetitionTypeDto): Promise<CompetitionType> {
    const existing = await this.compTypeRepository.findOne({ where: { name: createCompetitionTypeDto.name } });
    if (existing) {
      throw new ConflictException(`La categoría '${createCompetitionTypeDto.name}' ya existe.`);
    }
    const newType = this.compTypeRepository.create(createCompetitionTypeDto);
    return await this.compTypeRepository.save(newType);
  }

  async findAll(): Promise<CompetitionType[]> {
    return await this.compTypeRepository.find({ order: { name: 'ASC' } });
  }

  async findOne(id: string): Promise<CompetitionType> {
    const type = await this.compTypeRepository.findOne({ where: { id } });
    if (!type) throw new NotFoundException(`Tipo de competencia con ID ${id} no encontrado.`);
    return type;
  }

  async update(id: string, updateCompetitionTypeDto: UpdateCompetitionTypeDto): Promise<CompetitionType> {
    const type = await this.findOne(id);
    const updatedType = Object.assign(type, updateCompetitionTypeDto);
    return await this.compTypeRepository.save(updatedType);
  }

  async remove(id: string): Promise<void> {
    const type = await this.findOne(id);
    await this.compTypeRepository.remove(type);
  }
}
