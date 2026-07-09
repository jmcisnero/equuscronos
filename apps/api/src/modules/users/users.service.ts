import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { User } from "./entities/user.entity";
import { Tenant } from "../tenants/entities/tenant.entity";
import { CreateUserDto } from "./dto/create-user.dto";
import { UpdateUserDto } from "./dto/update-user.dto";
import { UserRole } from "@equuscronos/shared";
import * as bcrypt from "bcrypt";

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Tenant)
    private readonly tenantRepository: Repository<Tenant>,
  ) {}

  async create(createUserDto: CreateUserDto, executor?: any): Promise<User> {
    if (createUserDto.role === UserRole.ADMIN) {
      if (!executor || executor.role !== UserRole.ADMIN) {
        console.error(`[AUDIT SECURITY ALERT] Intento de escalada de privilegios: El usuario ${executor?.email || executor?.id || "Desconocido"} (Rol: ${executor?.role || "Ninguno"}) intentó crear un SuperAdmin.`);
        throw new ForbiddenException(
          "Operación no autorizada: Escalada de privilegios denegada"
        );
      }
    }

    const existingEmail = await this.userRepository.findOne({
      where: { email: createUserDto.email },
    });
    if (existingEmail) {
      throw new ConflictException("El correo electrónico ya está en uso.");
    }

    if (createUserDto.role === UserRole.CLUB_ADMIN && !createUserDto.tenantId) {
      throw new BadRequestException(
        "El club/organización es obligatorio para el rol CLUB_ADMIN.",
      );
    }

    let tenant = null;
    if (createUserDto.tenantId) {
      tenant = await this.tenantRepository.findOne({
        where: { id: createUserDto.tenantId },
      });
      if (!tenant) throw new NotFoundException("Club asignado no encontrado.");
    }

    // Hash password before saving
    let passwordHash = createUserDto.passwordHash;
    if (passwordHash) {
      passwordHash = await bcrypt.hash(passwordHash, 10);
    }

    const newUser = this.userRepository.create({
      ...createUserDto,
      passwordHash,
      tenant,
    });
    return await this.userRepository.save(newUser);
  }

  async findAll(): Promise<User[]> {
    return await this.userRepository.find({
      relations: ["tenant"],
      order: { name: "ASC" },
    });
  }

  async findOne(id: string): Promise<User> {
    const user = await this.userRepository.findOne({
      where: { id },
      relations: ["tenant"],
    });
    if (!user)
      throw new NotFoundException(`Usuario con ID ${id} no encontrado.`);
    return user;
  }

  async update(
    id: string,
    updateUserDto: UpdateUserDto,
    executor?: any,
  ): Promise<User> {
    if (updateUserDto.role === UserRole.ADMIN) {
      if (!executor || executor.role !== UserRole.ADMIN) {
        console.error(
          `[AUDIT SECURITY ALERT] Intento de escalada de privilegios: El usuario ${
            executor?.email || executor?.id || "Desconocido"
          } (Rol: ${
            executor?.role || "Ninguno"
          }) intentó asignar el rol ADMIN al usuario ${id}.`,
        );
        throw new ForbiddenException(
          "Operación no autorizada: Escalada de privilegios denegada",
        );
      }
    }

    const user = await this.findOne(id);

    const finalRole =
      updateUserDto.role !== undefined ? updateUserDto.role : user.role;
    const finalTenantId =
      updateUserDto.tenantId !== undefined
        ? updateUserDto.tenantId
        : user.tenant?.id;

    if (finalRole === UserRole.CLUB_ADMIN && !finalTenantId) {
      throw new BadRequestException(
        "El club/organización es obligatorio para el rol CLUB_ADMIN.",
      );
    }

    if (updateUserDto.tenantId) {
      const tenant = await this.tenantRepository.findOne({
        where: { id: updateUserDto.tenantId },
      });
      if (!tenant) throw new NotFoundException("Club asignado no encontrado.");
      user.tenant = tenant;
    } else if (updateUserDto.tenantId === null) {
      user.tenant = null;
    }

    if (updateUserDto.passwordHash) {
      user.passwordHash = await bcrypt.hash(updateUserDto.passwordHash, 10);
      delete updateUserDto.passwordHash;
    }

    const updatedUser = Object.assign(user, updateUserDto);
    return await this.userRepository.save(updatedUser);
  }

  async remove(id: string): Promise<void> {
    const user = await this.findOne(id);
    await this.userRepository.remove(user);
  }
}
