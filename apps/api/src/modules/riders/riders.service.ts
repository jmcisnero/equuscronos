import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Rider } from './entities/rider.entity';

@Injectable()
export class RidersService {
  constructor(
    @InjectRepository(Rider)
    private readonly riderRepository: Repository<Rider>,
  ) {}

  // Listar todos los jinetes registrados
  async findAll(): Promise<Rider[]> {
    return await this.riderRepository.find({
      order: { name: 'ASC' },
    });
  }

  // Buscar jinete por Cédula (CI) - Crucial para evitar duplicados en el registro
  async findByNationalId(nationalId: string): Promise<Rider> {
    const rider = await this.riderRepository.findOne({
      where: { nationalId },
    });

    if (!rider) {
      throw new NotFoundException(`No se encontró jinete registrado con la CI: ${nationalId}`);
    }
    return rider;
  }

  // Crear un nuevo jinete desde el panel administrativo
  async create(data: Partial<Rider>): Promise<Rider> {
    const newRider = this.riderRepository.create(data);
    return await this.riderRepository.save(newRider);
  }
}
