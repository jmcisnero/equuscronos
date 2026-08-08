import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  OnModuleInit,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, DataSource } from "typeorm";
import { Rider } from "./entities/rider.entity";
import { CreateRiderDto } from "./dto/create-rider.dto";
import { UpdateRiderDto } from "./dto/update-rider.dto";

@Injectable()
export class RidersService implements OnModuleInit {
  constructor(
    @InjectRepository(Rider)
    private readonly riderRepository: Repository<Rider>,
    private readonly dataSource: DataSource,
  ) {}

  async onModuleInit() {
    try {
      await this.dataSource.query(`
        ALTER TABLE riders ALTER COLUMN national_id DROP NOT NULL;
        ALTER TABLE riders ALTER COLUMN is_feu_active SET DEFAULT true;
        ALTER TABLE horses ALTER COLUMN is_feu_active SET DEFAULT true;
      `);
    } catch (err: any) {
      // Ignorar si las columnas ya fueron alteradas
    }
  }

  /**
   * Registra un nuevo jinete en el sistema.
   * Regla FEU de Unicidad: Valida de manera estricta que no exista otro jinete con la misma Cédula (national_id)
   * o Licencia FEU (feu_id), evitando duplicaciones en el padrón nacional de atletas.
   * El formato de las fechas se recibe e inserta como string inmutable (YYYY-MM-DD) para evitar el desfase de huso horario.
   */
  async create(createRiderDto: CreateRiderDto): Promise<Rider> {
    const cleanedDto: Partial<Rider> = {
      ...createRiderDto,
      nationalId: createRiderDto.nationalId?.trim() || null,
      feuId: createRiderDto.feuId?.trim() || null,
      birthDate: createRiderDto.birthDate?.trim() || null,
      medicalCardExpiration: createRiderDto.medicalCardExpiration?.trim() || null,
    };

    // 1. Validar unicidad de la Cédula de Identidad (nationalId) si es provista
    if (cleanedDto.nationalId) {
      const existingByNationalId = await this.riderRepository.findOne({
        where: { nationalId: cleanedDto.nationalId },
      });
      if (existingByNationalId) {
        throw new ConflictException(
          `Ya existe un jinete registrado con la cédula ${cleanedDto.nationalId}`,
        );
      }
    }

    // 2. Validar unicidad de la Licencia FEU (feuId) si es provista
    if (cleanedDto.feuId) {
      const existingByFeuId = await this.riderRepository.findOne({
        where: { feuId: cleanedDto.feuId },
      });
      if (existingByFeuId) {
        throw new ConflictException(
          `Conflicto de Datos: Ya existe un jinete registrado con la Licencia FEU ${cleanedDto.feuId}`,
        );
      }
    }

    try {
      const newRider = this.riderRepository.create(cleanedDto);
      return await this.riderRepository.save(newRider);
    } catch (err: any) {
      if (err.code === "23502") {
        throw new BadRequestException(
          `Falta completar un campo obligatorio: ${err.column || "campo requerido"}.`,
        );
      }
      if (err.code === "23505") {
        throw new ConflictException(
          "Ya existe un jinete registrado con esa cédula de identidad o número de licencia.",
        );
      }
      if (err.code === "22007" || err.message?.includes("date")) {
        throw new BadRequestException(
          "Formato de fecha inválido. Ingrese una fecha válida (YYYY-MM-DD).",
        );
      }
      throw new BadRequestException(
        err.detail || err.message || "Error al registrar el jinete.",
      );
    }
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
    const query = this.riderRepository.createQueryBuilder("rider");

    if (search) {
      query.where(
        "(LOWER(rider.name) LIKE LOWER(:search) OR LOWER(rider.nationalId) LIKE LOWER(:search) OR LOWER(rider.feuId) LIKE LOWER(:search))",
        { search: `%${search}%` },
      );
    }

    query.orderBy("rider.name", "ASC");
    return await query.getMany();
  }

  async findOne(id: string): Promise<Rider> {
    const rider = await this.riderRepository.findOne({ where: { id } });
    if (!rider)
      throw new NotFoundException(`Jinete con ID ${id} no encontrado.`);
    return rider;
  }

  /**
   * Modifica los datos de un jinete.
   * Valida que no se dupliquen campos únicos (cédula o licencia FEU) contra otros registros existentes.
   */
  async update(id: string, updateRiderDto: UpdateRiderDto): Promise<Rider> {
    const rider = await this.findOne(id);

    const cleanedDto: Partial<Rider> = {
      ...updateRiderDto,
      nationalId:
        updateRiderDto.nationalId !== undefined
          ? updateRiderDto.nationalId?.trim() || null
          : rider.nationalId,
      feuId:
        updateRiderDto.feuId !== undefined
          ? updateRiderDto.feuId?.trim() || null
          : rider.feuId,
      birthDate:
        updateRiderDto.birthDate !== undefined
          ? updateRiderDto.birthDate?.trim() || null
          : rider.birthDate,
      medicalCardExpiration:
        updateRiderDto.medicalCardExpiration !== undefined
          ? updateRiderDto.medicalCardExpiration?.trim() || null
          : rider.medicalCardExpiration,
    };

    // Validar cédula única si es modificada y provista
    if (
      cleanedDto.nationalId &&
      cleanedDto.nationalId !== rider.nationalId
    ) {
      const existingByNationalId = await this.riderRepository.findOne({
        where: { nationalId: cleanedDto.nationalId },
      });
      if (existingByNationalId) {
        throw new ConflictException(
          `Ya existe otro jinete registrado con la cédula ${cleanedDto.nationalId}`,
        );
      }
    }

    // Validar licencia FEU única si es modificada y provista
    if (
      cleanedDto.feuId &&
      cleanedDto.feuId !== rider.feuId
    ) {
      const existingByFeuId = await this.riderRepository.findOne({
        where: { feuId: cleanedDto.feuId },
      });
      if (existingByFeuId) {
        throw new ConflictException(
          `Conflicto de Datos: Ya existe otro jinete registrado con la Licencia FEU ${cleanedDto.feuId}`,
        );
      }
    }

    try {
      const updatedRider = Object.assign(rider, cleanedDto);
      return await this.riderRepository.save(updatedRider);
    } catch (err: any) {
      if (err.code === "23505") {
        throw new ConflictException(
          "Ya existe otro jinete registrado con esa cédula de identidad o número de licencia.",
        );
      }
      if (err.code === "22007" || err.message?.includes("date")) {
        throw new BadRequestException(
          "Formato de fecha inválido. Ingrese una fecha válida (YYYY-MM-DD).",
        );
      }
      throw new BadRequestException(
        err.detail || err.message || "Error al actualizar el jinete.",
      );
    }
  }

  async remove(id: string): Promise<void> {
    const rider = await this.findOne(id);
    // Nota: Si el jinete tiene carreras en competition_entries,
    // TypeORM bloqueará el borrado por el ON DELETE RESTRICT de la base de datos.
    await this.riderRepository.remove(rider);
  }
}
