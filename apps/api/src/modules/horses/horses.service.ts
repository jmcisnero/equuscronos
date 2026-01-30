import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Horse } from './entities/horse.entity';

@Injectable()
export class HorsesService {
  constructor(
    @InjectRepository(Horse)
    private readonly horseRepository: Repository<Horse>,
  ) {}

  // Listar todos los caballos con su dueño (importante para las planillas)
  async findAll(): Promise<Horse[]> {
    return await this.horseRepository.find({
      relations: ['owner'],
      order: { name: 'ASC' },
    });
  }

  // Buscar un caballo por su ID de chip (Vital para la Field App en pista)
  async findByChip(chipId: string): Promise<Horse> {
    const horse = await this.horseRepository.findOne({
      where: { chipId },
      relations: ['owner'],
    });

    if (!horse) {
      throw new NotFoundException(`No se encontró ningún equino con el chip: ${chipId}`);
    }
    return horse;
  }

  // Registrar un nuevo caballo (Usado desde Admin Web)
  async create(data: Partial<Horse>): Promise<Horse> {
    const newHorse = this.horseRepository.create(data);
    return await this.horseRepository.save(newHorse);
  }
}
