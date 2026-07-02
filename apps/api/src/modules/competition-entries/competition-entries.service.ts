import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { CompetitionEntry } from "./entities/competition-entry.entity";
import { CreateCompetitionEntryDto } from "./dto/create-competition-entry.dto";
import { UpdateCompetitionEntryDto } from "./dto/update-competition-entry.dto";
import { Competition } from "../competitions/entities/competition.entity";
import { Rider } from "../riders/entities/rider.entity";
import { Horse } from "../horses/entities/horse.entity";
import { Tenant } from "../tenants/entities/tenant.entity";
import { WeightControl } from "../weight-controls/entities/weight-control.entity";
import { CompetitionStatus, ParticipantStatus } from "@equuscronos/shared";

@Injectable()
export class CompetitionEntriesService {
  constructor(
    @InjectRepository(CompetitionEntry)
    private readonly entryRepo: Repository<CompetitionEntry>,
    @InjectRepository(Competition)
    private readonly compRepo: Repository<Competition>,
    @InjectRepository(Rider) private readonly riderRepo: Repository<Rider>,
    @InjectRepository(Horse) private readonly horseRepo: Repository<Horse>,
    @InjectRepository(Tenant) private readonly tenantRepo: Repository<Tenant>,
    @InjectRepository(WeightControl)
    private readonly weightRepo: Repository<WeightControl>,
  ) {}

  async create(dto: CreateCompetitionEntryDto): Promise<CompetitionEntry> {
    // 1. Validar que la Competencia, Jinete y Caballo existan
    const competition = await this.compRepo.findOne({
      where: { id: dto.competitionId },
      relations: ["tenant", "competitionType"],
    });
    if (!competition) throw new NotFoundException("Competencia no encontrada.");

    // Regla de Oro: Asegurar que los datos sean inmutables una vez que la competencia cambie a estado ACTIVE o posterior
    if (
      competition.status === CompetitionStatus.ACTIVE ||
      competition.status === CompetitionStatus.COMPLETED ||
      competition.status === CompetitionStatus.OFFICIAL ||
      competition.status === CompetitionStatus.CANCELLED
    ) {
      throw new BadRequestException(
        "No se pueden registrar nuevas inscripciones una vez que la competencia está ACTIVA o finalizada.",
      );
    }

    // Regla de Negocio (Art. 20): Validar peso mínimo reglamentario si está configurado
    const rules = competition.competitionType?.defaultRules || {};
    const minWeightReglementary = rules.min_weight_kg ?? rules.min_weight ?? 85;
    if (dto.ballastWeight !== undefined && dto.ballastWeight !== null) {
      if (dto.ballastWeight < minWeightReglementary) {
        throw new BadRequestException(
          `Falta de peso según Art. 20: El peso registrado (${dto.ballastWeight} kg) es menor al mínimo reglamentario de la modalidad (${minWeightReglementary} kg) para la habilitación.`,
        );
      }
    }

    const rider = await this.riderRepo.findOne({ where: { id: dto.riderId } });
    if (!rider) throw new NotFoundException("Jinete no encontrado.");

    const horse = await this.horseRepo.findOne({ where: { id: dto.horseId } });
    if (!horse) throw new NotFoundException("Caballo no encontrado.");

    // Reglamento FEU Art. 24g: Edad mínima de 6 años para competir en Raid FEU
    if (
      (competition.competitionType?.name === "Raid FEU" ||
        competition.competitionType?.name?.startsWith("Raid FEU")) &&
      horse.birthDate
    ) {
      const raceDate = new Date(competition.competitionDate);
      const birthDate = new Date(horse.birthDate);
      const diffTime = raceDate.getTime() - birthDate.getTime();
      const diffDays = diffTime / (1000 * 60 * 60 * 24);
      if (diffDays < 2190) {
        throw new BadRequestException(
          "El equino no cumple con la edad mínima reglamentaria de 6 años para competir (Art. 24g)",
        );
      }
    }

    let representedTenant = null;
    if (dto.representedTenantId) {
      representedTenant = await this.tenantRepo.findOne({
        where: { id: dto.representedTenantId },
      });
      if (!representedTenant)
        throw new NotFoundException("Club representado no encontrado.");
    }

    // 2. Regla de Negocio: Un dorsal no se puede repetir en la misma carrera
    const existingBib = await this.entryRepo.findOne({
      where: {
        competition: { id: dto.competitionId },
        bibNumber: dto.bibNumber,
      },
    });
    if (existingBib)
      throw new ConflictException(
        `El dorsal #${dto.bibNumber} ya está en uso en esta carrera.`,
      );

    // 3. Reglas de Negocio: Un jinete o caballo no puede inscribirse más de una vez en la misma carrera
    const existingRider = await this.entryRepo.findOne({
      where: {
        competition: { id: dto.competitionId },
        rider: { id: dto.riderId },
      },
    });
    if (existingRider) {
      throw new ConflictException(
        `El jinete seleccionado ya está inscripto en esta carrera.`,
      );
    }

    const existingHorse = await this.entryRepo.findOne({
      where: {
        competition: { id: dto.competitionId },
        horse: { id: dto.horseId },
      },
    });
    if (existingHorse) {
      throw new ConflictException(
        `El caballo seleccionado ya está inscripto en esta carrera.`,
      );
    }

    // 4. Crear inscripción
    const newEntry = this.entryRepo.create({
      ...dto,
      competition,
      rider,
      horse,
      representedTenant,
      tenant: competition.tenant,
      weighInAt:
        dto.weighInAt ?? (dto.ballastWeight !== undefined ? new Date() : null),
    });

    const savedEntry = await this.entryRepo.save(newEntry);

    // Crear automáticamente un WeightControl de tipo INITIAL si tiene ballastWeight
    if (
      savedEntry.ballastWeight !== undefined &&
      savedEntry.ballastWeight !== null
    ) {
      const initialWeightControl = this.weightRepo.create({
        entry: savedEntry,
        weightRecorded: savedEntry.ballastWeight,
        controlType: "INITIAL",
        recordedAt: savedEntry.weighInAt || new Date(),
      });
      await this.weightRepo.save(initialWeightControl);
    }

    return savedEntry;
  }

  async findAllByCompetition(
    competitionId: string,
  ): Promise<CompetitionEntry[]> {
    return await this.entryRepo.find({
      where: { competition: { id: competitionId } },
      relations: [
        "rider",
        "horse",
        "representedTenant",
        "currentStage",
        "timingRecords",
        "timingRecords.stage",
        "timingRecords.vetInspection",
      ],
      order: { bibNumber: "ASC" },
    });
  }

  async findOne(id: string): Promise<CompetitionEntry> {
    const entry = await this.entryRepo.findOne({
      where: { id },
      relations: [
        "competition",
        "competition.competitionType",
        "rider",
        "horse",
        "representedTenant",
        "currentStage",
      ],
    });
    if (!entry) throw new NotFoundException("Inscripción no encontrada.");
    return entry;
  }

  async update(
    id: string,
    dto: UpdateCompetitionEntryDto,
  ): Promise<CompetitionEntry> {
    const entry = await this.findOne(id);

    // Regla de Oro: Asegurar que los datos de inscripción (Jinete, Caballo, Dorsal, Club) sean inmutables una vez que la competencia cambie a estado ACTIVE o posterior
    if (
      entry.competition.status === CompetitionStatus.ACTIVE ||
      entry.competition.status === CompetitionStatus.COMPLETED ||
      entry.competition.status === CompetitionStatus.OFFICIAL ||
      entry.competition.status === CompetitionStatus.CANCELLED
    ) {
      if (
        dto.riderId ||
        dto.horseId ||
        dto.bibNumber ||
        dto.representedTenantId
      ) {
        throw new BadRequestException(
          "No se pueden modificar los datos de inscripción (Jinete, Caballo, Dorsal) una vez que la competencia está ACTIVA o finalizada.",
        );
      }
    }

    // Regla de Negocio (Art. 20): Validar peso mínimo reglamentario si está configurado e ingresado
    if (dto.ballastWeight !== undefined && dto.ballastWeight !== null) {
      const rules = entry.competition.competitionType?.defaultRules || {};
      const minWeightReglementary =
        rules.min_weight_kg ?? rules.min_weight ?? 85;
      if (dto.ballastWeight < minWeightReglementary) {
        throw new BadRequestException(
          `Falta de peso según Art. 20: El peso registrado (${dto.ballastWeight} kg) es menor al mínimo reglamentario de la modalidad (${minWeightReglementary} kg) para la habilitación.`,
        );
      }
    }

    // Si intentan cambiar el dorsal, validar que no choque con otro
    if (dto.bibNumber && dto.bibNumber !== entry.bibNumber) {
      const existingBib = await this.entryRepo.findOne({
        where: {
          competition: { id: entry.competition.id },
          bibNumber: dto.bibNumber,
        },
      });
      if (existingBib)
        throw new ConflictException(
          `El dorsal #${dto.bibNumber} ya está en uso.`,
        );
    }

    // Si intentan cambiar el jinete, validar que no esté ya inscripto en esta carrera
    if (dto.riderId && dto.riderId !== entry.rider.id) {
      const existingRider = await this.entryRepo.findOne({
        where: {
          competition: { id: entry.competition.id },
          rider: { id: dto.riderId },
        },
      });
      if (existingRider) {
        throw new ConflictException(
          "El jinete seleccionado ya está inscripto en esta carrera.",
        );
      }
    }

    // Si intentan cambiar el caballo, validar que no esté ya inscripto en esta carrera
    if (dto.horseId && dto.horseId !== entry.horse.id) {
      const existingHorse = await this.entryRepo.findOne({
        where: {
          competition: { id: entry.competition.id },
          horse: { id: dto.horseId },
        },
      });
      if (existingHorse) {
        throw new ConflictException(
          "El caballo seleccionado ya está inscripto en esta carrera.",
        );
      }

      // Validar edad si es Raid FEU
      const newHorse = await this.horseRepo.findOne({
        where: { id: dto.horseId },
      });
      if (!newHorse) throw new NotFoundException("Caballo no encontrado.");

      if (
        (entry.competition.competitionType?.name === "Raid FEU" ||
          entry.competition.competitionType?.name?.startsWith("Raid FEU")) &&
        newHorse.birthDate
      ) {
        const raceDate = new Date(entry.competition.competitionDate);
        const birthDate = new Date(newHorse.birthDate);
        const diffTime = raceDate.getTime() - birthDate.getTime();
        const diffDays = diffTime / (1000 * 60 * 60 * 24);
        if (diffDays < 2190) {
          throw new BadRequestException(
            "El equino no cumple con la edad mínima reglamentaria de 6 años para competir (Art. 24g)",
          );
        }
      }
    }

    // Si agregan peso o precinto por primera vez, marcar weighInAt
    if (dto.ballastWeight !== undefined && !entry.weighInAt) {
      entry.weighInAt = new Date();
    }

    // Si el binomio ya está eliminado (DQ, DNF, WD), no permitir que actualizaciones subsiguientes (como sincronizaciones) lo regresen a competencia.
    const finalStatuses = [
      ParticipantStatus.DQ,
      ParticipantStatus.DNF,
      ParticipantStatus.WD,
    ];
    if (finalStatuses.includes(entry.status)) {
      if (
        dto.status &&
        !finalStatuses.includes(dto.status as ParticipantStatus)
      ) {
        delete dto.status;
      }
    }

    const updatedEntry = Object.assign(entry, dto);
    const savedEntry = await this.entryRepo.save(updatedEntry);

    // Actualizar o crear automáticamente el WeightControl de tipo INITIAL
    if (dto.ballastWeight !== undefined && dto.ballastWeight !== null) {
      let initialControl = await this.weightRepo.findOne({
        where: {
          entry: { id: entry.id },
          controlType: "INITIAL",
        },
      });
      if (initialControl) {
        initialControl.weightRecorded = dto.ballastWeight;
        initialControl.recordedAt = savedEntry.weighInAt || new Date();
        await this.weightRepo.save(initialControl);
      } else {
        initialControl = this.weightRepo.create({
          entry: savedEntry,
          weightRecorded: dto.ballastWeight,
          controlType: "INITIAL",
          recordedAt: savedEntry.weighInAt || new Date(),
        });
        await this.weightRepo.save(initialControl);
      }
    }

    return savedEntry;
  }

  async remove(id: string): Promise<void> {
    const entry = await this.findOne(id);

    // Regla de Oro: Asegurar que los datos sean inmutables una vez que la competencia cambie a estado ACTIVE o posterior
    if (
      entry.competition.status === CompetitionStatus.ACTIVE ||
      entry.competition.status === CompetitionStatus.COMPLETED ||
      entry.competition.status === CompetitionStatus.OFFICIAL ||
      entry.competition.status === CompetitionStatus.CANCELLED
    ) {
      throw new BadRequestException(
        "No se pueden dar de baja inscripciones una vez que la competencia está ACTIVA o finalizada.",
      );
    }

    await this.entryRepo.remove(entry);
  }
}
