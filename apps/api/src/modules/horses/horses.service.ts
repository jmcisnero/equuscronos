import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Horse } from "./entities/horse.entity";
import { Owner } from "../owners/entities/owner.entity";
import { CreateHorseDto } from "./dto/create-horse.dto";
import { UpdateHorseDto } from "./dto/update-horse.dto";
import { AssetsService } from "../assets/assets.service";

@Injectable()
export class HorsesService {
  constructor(
    @InjectRepository(Horse)
    private readonly horseRepository: Repository<Horse>,
    @InjectRepository(Owner)
    private readonly ownerRepository: Repository<Owner>,
    private readonly assetsService: AssetsService,
  ) {}

  async create(createHorseDto: CreateHorseDto): Promise<Horse> {
    const cleanedDto = {
      ...createHorseDto,
      chipId: createHorseDto.chipId?.trim() || null,
      feuId: createHorseDto.feuId?.trim() || null,
      healthRecordsExpiration: createHorseDto.healthRecordsExpiration?.trim() || null,
      birthDate: createHorseDto.birthDate?.trim() || null,
      imageUrl: createHorseDto.imageUrl?.trim() || null,
    };

    // 1. Validar Chips y Pasaportes duplicados
    if (cleanedDto.chipId) {
      const existingChip = await this.horseRepository.findOne({
        where: { chipId: cleanedDto.chipId },
      });
      if (existingChip)
        throw new ConflictException(
          `El chip ${cleanedDto.chipId} ya está registrado.`,
        );
    }

    if (cleanedDto.feuId) {
      const existingFeu = await this.horseRepository.findOne({
        where: { feuId: cleanedDto.feuId },
      });
      if (existingFeu)
        throw new ConflictException(
          `El pasaporte FEU ${cleanedDto.feuId} ya está registrado.`,
        );
    }

    // 2. Validar que el propietario exista (si se envía)
    let owner = null;
    if (cleanedDto.ownerId) {
      owner = await this.ownerRepository.findOne({
        where: { id: cleanedDto.ownerId },
      });
      if (!owner)
        throw new NotFoundException(
          `Propietario con ID ${cleanedDto.ownerId} no encontrado.`,
        );
    }

    // 3. Crear Entidad
    const newHorse = this.horseRepository.create({
      ...cleanedDto,
      owner: owner,
    });

    // 4. Auto-cálculo del estado FEU basado en sanidad vigente y edad mínima (6 años)
    newHorse.isFeuActive = this.computeFeuActive(newHorse);

    try {
      return await this.horseRepository.save(newHorse);
    } catch (err: any) {
      if (err.code === "23505") {
        throw new ConflictException(
          "Ya existe un equino registrado con ese número de chip RFID o pasaporte FEU.",
        );
      }
      if (err.code === "22007" || err.message?.includes("date")) {
        throw new BadRequestException(
          "Formato de fecha inválido. Use el formato YYYY-MM-DD.",
        );
      }
      throw new BadRequestException(
        err.detail || err.message || "Error al registrar el caballo.",
      );
    }
  }

  async findAll(search?: string): Promise<Horse[]> {
    const query = this.horseRepository
      .createQueryBuilder("horse")
      .leftJoinAndSelect("horse.owner", "owner");

    if (search) {
      const term = `%${search}%`;
      query.where(
        "(horse.name ILIKE :search OR horse.chipId ILIKE :search OR horse.feuId ILIKE :search OR owner.name ILIKE :search)",
        { search: term },
      );
    }

    query.orderBy("horse.name", "ASC");
    return await query.getMany();
  }

  async findOne(id: string): Promise<Horse> {
    const horse = await this.horseRepository.findOne({
      where: { id },
      relations: ["owner"],
    });
    if (!horse)
      throw new NotFoundException(`Caballo con ID ${id} no encontrado.`);
    return horse;
  }

  async update(id: string, updateHorseDto: UpdateHorseDto): Promise<Horse> {
    const horse = await this.findOne(id);

    const cleanedDto: Partial<Horse> = {
      ...updateHorseDto,
      chipId:
        updateHorseDto.chipId !== undefined
          ? updateHorseDto.chipId?.trim() || null
          : horse.chipId,
      feuId:
        updateHorseDto.feuId !== undefined
          ? updateHorseDto.feuId?.trim() || null
          : horse.feuId,
      healthRecordsExpiration:
        updateHorseDto.healthRecordsExpiration !== undefined
          ? updateHorseDto.healthRecordsExpiration?.trim() || null
          : (horse.healthRecordsExpiration as any),
      birthDate:
        updateHorseDto.birthDate !== undefined
          ? updateHorseDto.birthDate?.trim() || null
          : horse.birthDate,
      imageUrl:
        updateHorseDto.imageUrl !== undefined
          ? updateHorseDto.imageUrl?.trim() || null
          : horse.imageUrl,
    };

    // Si están actualizando el dueño, validarlo de nuevo
    if (updateHorseDto.ownerId) {
      const owner = await this.ownerRepository.findOne({
        where: { id: updateHorseDto.ownerId },
      });
      if (!owner) throw new NotFoundException("Propietario no encontrado.");
      horse.owner = owner;
    }

    const updatedHorse = Object.assign(horse, cleanedDto);

    // Auto-recálculo del estado FEU tras cada actualización
    updatedHorse.isFeuActive = this.computeFeuActive(updatedHorse);

    try {
      return await this.horseRepository.save(updatedHorse);
    } catch (err: any) {
      if (err.code === "23505") {
        throw new ConflictException(
          "Ya existe otro equino registrado con ese número de chip RFID o pasaporte FEU.",
        );
      }
      if (err.code === "22007" || err.message?.includes("date")) {
        throw new BadRequestException(
          "Formato de fecha inválido. Use el formato YYYY-MM-DD.",
        );
      }
      throw new BadRequestException(
        err.detail || err.message || "Error al actualizar el caballo.",
      );
    }
  }

  async remove(id: string): Promise<void> {
    const horse = await this.findOne(id);
    await this.horseRepository.remove(horse);
  }

  async uploadPhoto(id: string, file: any): Promise<Horse> {
    const horse = await this.findOne(id);
    if (!file || !file.buffer) {
      throw new ConflictException("No se proporcionó un archivo válido.");
    }
    const fileUrl = await this.assetsService.uploadFile(file, "horses");
    horse.imageUrl = fileUrl;
    return await this.horseRepository.save(horse);
  }

  /**
   * Determina automáticamente si un equino cumple las condiciones de habilitación FEU:
   * 1. Si tiene fecha de vencimiento de sanidad ingresada, no debe estar vencida.
   *    Un vencimiento de sanidad nulo o no ingresado NO inhabilita al equino para competir ni fuerce isFeuActive a false.
   * 2. Si tiene fecha de nacimiento registrada, debe cumplir edad mínima de 6 años.
   */
  private computeFeuActive(horse: Partial<Horse>): boolean {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Condición 1: Sanidad (solo inhabilita si la sanidad está explicita y vencida)
    if (horse.healthRecordsExpiration) {
      const healthExp = new Date(horse.healthRecordsExpiration);
      if (healthExp <= today) {
        return false;
      }
    }

    // Condición 2: Edad >= 6 años (solo inhabilita si se conoce fecha de nacimiento y es < 6 años)
    if (horse.birthDate) {
      const birthDate = new Date(horse.birthDate);
      const ageMs = today.getTime() - birthDate.getTime();
      const ageYears = ageMs / (365.25 * 24 * 60 * 60 * 1000);
      if (ageYears < 6) {
        return false;
      }
    }

    return horse.isFeuActive !== undefined ? horse.isFeuActive : true;
  }
}
