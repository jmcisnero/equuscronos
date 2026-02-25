import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { Tenant } from '../tenants/entities/tenant.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Tenant)
    private readonly tenantRepository: Repository<Tenant>,
  ) {}

  async create(createUserDto: CreateUserDto): Promise<User> {
    const existingEmail = await this.userRepository.findOne({ where: { email: createUserDto.email } });
    if (existingEmail) {
      throw new ConflictException('El correo electrónico ya está en uso.');
    }

    let tenant = null;
    if (createUserDto.tenantId) {
      tenant = await this.tenantRepository.findOne({ where: { id: createUserDto.tenantId } });
      if (!tenant) throw new NotFoundException('Club asignado no encontrado.');
    }

    const newUser = this.userRepository.create({ ...createUserDto, tenant });
    return await this.userRepository.save(newUser);
  }

  async findAll(): Promise<User[]> {
    return await this.userRepository.find({ relations: ['tenant'], order: { name: 'ASC' } });
  }

  async findOne(id: string): Promise<User> {
    const user = await this.userRepository.findOne({ where: { id }, relations: ['tenant'] });
    if (!user) throw new NotFoundException(`Usuario con ID ${id} no encontrado.`);
    return user;
  }

  async update(id: string, updateUserDto: UpdateUserDto): Promise<User> {
    const user = await this.findOne(id);

    if (updateUserDto.tenantId) {
      const tenant = await this.tenantRepository.findOne({ where: { id: updateUserDto.tenantId } });
      if (!tenant) throw new NotFoundException('Club asignado no encontrado.');
      user.tenant = tenant;
    }

    const updatedUser = Object.assign(user, updateUserDto);
    return await this.userRepository.save(updatedUser);
  }

  async remove(id: string): Promise<void> {
    const user = await this.findOne(id);
    await this.userRepository.remove(user);
  }
}
