import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Owner } from './entities/owner.entity';
import { CreateOwnerDto } from './dto/create-owner.dto';
import { UpdateOwnerDto } from './dto/update-owner.dto';

@Injectable()
export class OwnersService {
  constructor(
    @InjectRepository(Owner)
    private readonly ownerRepository: Repository<Owner>,
  ) {}

  async create(createOwnerDto: CreateOwnerDto): Promise<Owner> {
    const newOwner = this.ownerRepository.create(createOwnerDto);
    return await this.ownerRepository.save(newOwner);
  }

  async findAll(): Promise<Owner[]> {
    return await this.ownerRepository.find({ order: { name: 'ASC' } });
  }

  async findOne(id: string): Promise<Owner> {
    const owner = await this.ownerRepository.findOne({ where: { id } });
    if (!owner) throw new NotFoundException(`Propietario con ID ${id} no encontrado.`);
    return owner;
  }

  async update(id: string, updateOwnerDto: UpdateOwnerDto): Promise<Owner> {
    const owner = await this.findOne(id);
    const updatedOwner = Object.assign(owner, updateOwnerDto);
    return await this.ownerRepository.save(updatedOwner);
  }

  async remove(id: string): Promise<void> {
    const owner = await this.findOne(id);
    await this.ownerRepository.remove(owner);
  }
}
