import {
  Injectable,
  NotFoundException,
  ConflictException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Tenant } from "./entities/tenant.entity";
import { CreateTenantDto } from "./dto/create-tenant.dto";
import { UpdateTenantDto } from "./dto/update-tenant.dto";
import { AssetsService } from "../assets/assets.service";

@Injectable()
export class TenantsService {
  constructor(
    @InjectRepository(Tenant)
    private readonly tenantRepository: Repository<Tenant>,
    private readonly assetsService: AssetsService,
  ) {}

  async create(createTenantDto: CreateTenantDto): Promise<Tenant> {
    const existing = await this.tenantRepository.findOne({
      where: { name: createTenantDto.name },
    });
    if (existing) {
      throw new ConflictException(
        `La organización '${createTenantDto.name}' ya existe.`,
      );
    }

    if (createTenantDto.federationNumber) {
      const dupFed = await this.tenantRepository.findOne({
        where: { federationNumber: createTenantDto.federationNumber },
      });
      if (dupFed) {
        throw new ConflictException(
          `El número de federación ${createTenantDto.federationNumber} ya está registrado.`,
        );
      }
    }

    const newTenant = this.tenantRepository.create(createTenantDto);
    return await this.tenantRepository.save(newTenant);
  }

  async findAll(): Promise<Tenant[]> {
    return await this.tenantRepository.find({ order: { name: "ASC" } });
  }

  async findOne(id: string): Promise<Tenant> {
    const tenant = await this.tenantRepository.findOne({ where: { id } });
    if (!tenant)
      throw new NotFoundException(`Organización con ID ${id} no encontrada.`);
    return tenant;
  }

  async update(id: string, updateTenantDto: UpdateTenantDto): Promise<Tenant> {
    const tenant = await this.findOne(id);
    if (updateTenantDto.name && updateTenantDto.name !== tenant.name) {
      const existing = await this.tenantRepository.findOne({
        where: { name: updateTenantDto.name },
      });
      if (existing) {
        throw new ConflictException(
          `La organización '${updateTenantDto.name}' ya existe.`,
        );
      }
    }

    if (
      updateTenantDto.federationNumber &&
      updateTenantDto.federationNumber !== tenant.federationNumber
    ) {
      const dupFed = await this.tenantRepository.findOne({
        where: { federationNumber: updateTenantDto.federationNumber },
      });
      if (dupFed) {
        throw new ConflictException(
          `El número de federación ${updateTenantDto.federationNumber} ya está registrado.`,
        );
      }
    }

    const updatedTenant = Object.assign(tenant, updateTenantDto);
    return await this.tenantRepository.save(updatedTenant);
  }

  async remove(id: string): Promise<void> {
    const tenant = await this.findOne(id);
    await this.tenantRepository.remove(tenant);
  }

  async uploadJersey(id: string, file: any): Promise<Tenant> {
    const tenant = await this.findOne(id);
    if (!file || !file.buffer) {
      throw new ConflictException("No se proporcionó un archivo válido.");
    }
    const fileUrl = await this.assetsService.uploadFile(file, "jerseys");
    tenant.jerseyImageUrl = fileUrl;
    return await this.tenantRepository.save(tenant);
  }
}
