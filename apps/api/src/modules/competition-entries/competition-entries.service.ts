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

    // 3. Regla de Negocio: Un mismo binomio (Jinete+Caballo) no puede inscribirse dos veces
    const existingEntry = await this.entryRepo.findOne({
      where: {
        competition: { id: dto.competitionId },
        rider: { id: dto.riderId },
        horse: { id: dto.horseId },
      },
    });
    if (existingEntry)
      throw new ConflictException(
        "Este binomio ya está inscripto en esta carrera.",
      );

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
