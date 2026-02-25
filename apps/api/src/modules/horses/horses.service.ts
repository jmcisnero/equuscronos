import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Horse } from './entities/horse.entity';
import { Owner } from '../owners/entities/owner.entity';
import { CreateHorseDto } from './dto/create-horse.dto';
import { UpdateHorseDto } from './dto/update-horse.dto';

@Injectable()
export class HorsesService {
  constructor(
    @InjectRepository(Horse)
    private readonly horseRepository: Repository<Horse>,
    @InjectRepository(Owner)
    private readonly ownerRepository: Repository<Owner>,
  ) {}

  async create(createHorseDto: CreateHorseDto): Promise<Horse> {
    // 1. Validar Chips y Pasaportes duplicados
    if (createHorseDto.chipId) {
      const existingChip = await this.horseRepository.findOne({ where: { chipId: createHorseDto.chipId } });
      if (existingChip) throw new ConflictException(`El chip ${createHorseDto.chipId} ya está registrado.`);
    }

    // 2. Validar que el propietario exista (si se envía)
    let owner = null;
    if (createHorseDto.ownerId) {
      owner = await this.ownerRepository.findOne({ where: { id: createHorseDto.ownerId } });
      if (!owner) throw new NotFoundException(`Propietario con ID ${createHorseDto.ownerId} no encontrado.`);
    }

    // 3. Crear Entidad
    const newHorse = this.horseRepository.create({
      ...createHorseDto,
      owner: owner, // Asignamos la relación validada
    });

    return await this.horseRepository.save(newHorse);
  }

  async findAll(): Promise<Horse[]> {
    // Al listar caballos, incluimos los datos del propietario
    return await this.horseRepository.find({
      relations: ['owner'],
      order: { name: 'ASC' }
    });
  }

  async findOne(id: string): Promise<Horse> {
    const horse = await this.horseRepository.findOne({ 
      where: { id },
      relations: ['owner']
    });
    if (!horse) throw new NotFoundException(`Caballo con ID ${id} no encontrado.`);
    return horse;
  }

  async update(id: string, updateHorseDto: UpdateHorseDto): Promise<Horse> {
    const horse = await this.findOne(id);

    // Si están actualizando el dueño, validarlo de nuevo
    if (updateHorseDto.ownerId) {
      const owner = await this.ownerRepository.findOne({ where: { id: updateHorseDto.ownerId } });
      if (!owner) throw new NotFoundException('Propietario no encontrado.');
      horse.owner = owner;
    }

    const updatedHorse = Object.assign(horse, updateHorseDto);
    return await this.horseRepository.save(updatedHorse);
  }

  async remove(id: string): Promise<void> {
    const horse = await this.findOne(id);
    await this.horseRepository.remove(horse);
  }
}
