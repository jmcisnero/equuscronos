import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Rider } from './entities/rider.entity';
import { CreateRiderDto } from './dto/create-rider.dto';
import { UpdateRiderDto } from './dto/update-rider.dto';

@Injectable()
export class RidersService {
  constructor(
    @InjectRepository(Rider)
    private readonly riderRepository: Repository<Rider>,
  ) {}

  async create(createRiderDto: CreateRiderDto): Promise<Rider> {
    //Evitar duplicación de Cédula (national_id)
    const existingRider = await this.riderRepository.findOne({ 
      where: { nationalId: createRiderDto.nationalId } 
    });
    
    if (existingRider) {
      throw new ConflictException(`Ya existe un jinete con la cédula ${createRiderDto.nationalId}`);
    }

    const newRider = this.riderRepository.create(createRiderDto);
    return await this.riderRepository.save(newRider);
  }

  async findAll(): Promise<Rider[]> {
    return await this.riderRepository.find({ order: { name: 'ASC' } });
  }

  async findOne(id: string): Promise<Rider> {
    const rider = await this.riderRepository.findOne({ where: { id } });
    if (!rider) throw new NotFoundException(`Jinete con ID ${id} no encontrado.`);
    return rider;
  }

  async update(id: string, updateRiderDto: UpdateRiderDto): Promise<Rider> {
    const rider = await this.findOne(id);
    const updatedRider = Object.assign(rider, updateRiderDto);
    return await this.riderRepository.save(updatedRider);
  }

  async remove(id: string): Promise<void> {
    const rider = await this.findOne(id);
    // Nota: Si el jinete tiene carreras en competition_entries, 
    // TypeORM bloqueará el borrado por el ON DELETE RESTRICT de la base de datos.
    await this.riderRepository.remove(rider);
  }
}
