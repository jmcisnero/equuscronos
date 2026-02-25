import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Tenant } from './entities/tenant.entity';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';

@Injectable()
export class TenantsService {
  constructor(
    @InjectRepository(Tenant)
    private readonly tenantRepository: Repository<Tenant>,
  ) {}

  async create(createTenantDto: CreateTenantDto): Promise<Tenant> {
    const existing = await this.tenantRepository.findOne({ where: { name: createTenantDto.name } });
    if (existing) {
      throw new ConflictException(`La organización '${createTenantDto.name}' ya existe.`);
    }
    const newTenant = this.tenantRepository.create(createTenantDto);
    return await this.tenantRepository.save(newTenant);
  }

  async findAll(): Promise<Tenant[]> {
    return await this.tenantRepository.find({ order: { name: 'ASC' } });
  }

  async findOne(id: string): Promise<Tenant> {
    const tenant = await this.tenantRepository.findOne({ where: { id } });
    if (!tenant) throw new NotFoundException(`Organización con ID ${id} no encontrada.`);
    return tenant;
  }

  async update(id: string, updateTenantDto: UpdateTenantDto): Promise<Tenant> {
    const tenant = await this.findOne(id);
    const updatedTenant = Object.assign(tenant, updateTenantDto);
    return await this.tenantRepository.save(updatedTenant);
  }

  async remove(id: string): Promise<void> {
    const tenant = await this.findOne(id);
    await this.tenantRepository.remove(tenant);
  }
}
