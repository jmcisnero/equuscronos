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

  /**
   * Registra un nuevo jinete en el sistema.
   * Regla FEU de Unicidad: Valida de manera estricta que no exista otro jinete con la misma Cédula (national_id)
   * o Licencia FEU (feu_id), evitando duplicaciones en el padrón nacional de atletas.
   * El formato de las fechas se recibe e inserta como string inmutable (YYYY-MM-DD) para evitar el desfase de huso horario.
   */
  async create(createRiderDto: CreateRiderDto): Promise<Rider> {
    // 1. Validar unicidad de la Cédula de Identidad (nationalId)
    const existingByNationalId = await this.riderRepository.findOne({ 
      where: { nationalId: createRiderDto.nationalId } 
    });
    if (existingByNationalId) {
      throw new ConflictException(`Ya existe un jinete registrado con la cédula ${createRiderDto.nationalId}`);
    }

    // 2. Validar unicidad de la Licencia FEU (feuId) si es provista
    if (createRiderDto.feuId) {
      const existingByFeuId = await this.riderRepository.findOne({
        where: { feuId: createRiderDto.feuId }
      });
      if (existingByFeuId) {
        throw new ConflictException(`Conflicto de Datos: Ya existe un jinete registrado con la Licencia FEU ${createRiderDto.feuId}`);
      }
    }

    const newRider = this.riderRepository.create(createRiderDto);
    return await this.riderRepository.save(newRider);
  }

  /**
   * Implementación de Omni-Search para el Padrón de Jinetes de la FEU.
   * Soporta una búsqueda global insensible a mayúsculas/minúsculas (?search=...)
   * a través de QueryBuilder, buscando coincidencias parciales por:
   * - Nombre del jinete
   * - Licencia FEU
   * - Cédula de Identidad
   */
  async findAll(search?: string): Promise<Rider[]> {
    const query = this.riderRepository.createQueryBuilder('rider');

    if (search) {
      query.where(
        '(LOWER(rider.name) LIKE LOWER(:search) OR LOWER(rider.nationalId) LIKE LOWER(:search) OR LOWER(rider.feuId) LIKE LOWER(:search))',
        { search: `%${search}%` }
      );
    }

    query.orderBy('rider.name', 'ASC');
    return await query.getMany();
  }

  async findOne(id: string): Promise<Rider> {
    const rider = await this.riderRepository.findOne({ where: { id } });
    if (!rider) throw new NotFoundException(`Jinete con ID ${id} no encontrado.`);
    return rider;
  }

  /**
   * Modifica los datos de un jinete.
   * Valida que no se dupliquen campos únicos (cédula o licencia FEU) contra otros registros existentes.
   */
  async update(id: string, updateRiderDto: UpdateRiderDto): Promise<Rider> {
    const rider = await this.findOne(id);

    // Validar cédula única si es modificada
    if (updateRiderDto.nationalId && updateRiderDto.nationalId !== rider.nationalId) {
      const existingByNationalId = await this.riderRepository.findOne({
        where: { nationalId: updateRiderDto.nationalId }
      });
      if (existingByNationalId) {
        throw new ConflictException(`Ya existe otro jinete registrado con la cédula ${updateRiderDto.nationalId}`);
      }
    }

    // Validar licencia FEU única si es modificada
    if (updateRiderDto.feuId && updateRiderDto.feuId !== rider.feuId) {
      const existingByFeuId = await this.riderRepository.findOne({
        where: { feuId: updateRiderDto.feuId }
      });
      if (existingByFeuId) {
        throw new ConflictException(`Conflicto de Datos: Ya existe otro jinete registrado con la Licencia FEU ${updateRiderDto.feuId}`);
      }
    }

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
