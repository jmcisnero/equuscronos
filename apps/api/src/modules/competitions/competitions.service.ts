import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ConflictException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, DataSource } from "typeorm";
import { Competition } from "./entities/competition.entity";
import { Stage } from "./entities/stage.entity";
import { Tenant } from "../tenants/entities/tenant.entity";
import { CompetitionType } from "../competition-types/entities/competition-type.entity";
import { CreateCompetitionDto } from "./dto/create-competition.dto";
import { UpdateCompetitionDto } from "./dto/update-competition.dto";
import {
  CompetitionStatus,
  ParticipantStatus,
  TimeRecordType,
} from "@equuscronos/shared";
import { TimingRecord } from "./entities/timing-record.entity";
import { CompetitionEntry } from "../competition-entries/entities/competition-entry.entity";

@Injectable()
export class CompetitionsService {
  constructor(
    @InjectRepository(Competition)
    private readonly compRepository: Repository<Competition>,
    private readonly dataSource: DataSource,
  ) {}

  async createCompetitionWithStages(
    dto: CreateCompetitionDto,
  ): Promise<Competition> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. Validar existencias (Tenant y Tipo de Regla)
      const tenant = await queryRunner.manager.findOne(Tenant, {
        where: { id: dto.tenantId },
      });
      if (!tenant)
        throw new NotFoundException("Organización (Tenant) no encontrada.");

      const compType = await queryRunner.manager.findOne(CompetitionType, {
        where: { id: dto.competitionTypeId },
      });
      if (!compType)
        throw new NotFoundException("Tipo de competencia no encontrado.");

      // 2. Crear la entidad principal (Competencia)
      const competition = this.compRepository.create({
        tenant,
        competitionType: compType,
        name: dto.name,
        competitionDate: dto.competitionDate,
        startTime: dto.startTime,
        location: dto.location,
        isFederated: dto.isFederated ?? false,
        status: dto.status,
      });

      const savedCompetition = await queryRunner.manager.save(
        Competition,
        competition,
      );

      // 3. Crear y asociar las Etapas
      const stagesToSave = dto.stages.map((stageDto) => {
        return queryRunner.manager.create(Stage, {
          competition: savedCompetition,
          tenant: tenant,
          stageNumber: stageDto.stageNumber,
          distanceKm: stageDto.distanceKm,
          neutralizationMinutes: stageDto.neutralizationMinutes ?? 0,
        });
      });

      await queryRunner.manager.save(Stage, stagesToSave);

      // 4. Confirmar transacción
      await queryRunner.commitTransaction();

      // Retornar la competencia con sus etapas incluidas
      return this.findOne(savedCompetition.id);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw new BadRequestException(
        `Error al crear la competencia: ${error.message}`,
      );
    } finally {
      await queryRunner.release();
    }
  }

  async findOne(id: string): Promise<Competition> {
    const comp = await this.compRepository.findOne({
      where: { id },
      relations: ["stages", "tenant", "competitionType"], // Trae los datos anidados
    });
    if (!comp) throw new NotFoundException("Competencia no encontrada.");
    return comp;
  }

  async findAll(): Promise<Competition[]> {
    return this.compRepository.find({
      order: { competitionDate: "DESC" },
      relations: ["stages", "tenant", "competitionType"],
    });
  }

  async update(
    id: string,
    updateDto: UpdateCompetitionDto,
  ): Promise<Competition> {
    const competition = await this.compRepository.findOne({
      where: { id },
    });
    if (!competition) {
      throw new NotFoundException(`Evento con ID ${id} no encontrado`);
    }
    // Bloqueo de estado: Solo se permite editar eventos en estado PLANNED
    if (competition.status !== CompetitionStatus.PLANNED) {
      throw new BadRequestException(
        "Solo se permite editar eventos en estado PLANNED",
      );
    }

    // Fusionamos los cambios del DTO en la entidad existente
    Object.assign(competition, updateDto);

    return await this.compRepository.save(competition);
  }

  async remove(id: string): Promise<void> {
    const competition = await this.compRepository.findOne({ where: { id } });
    if (!competition) throw new NotFoundException("Competencia no encontrada.");

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. Obtener todos los IDs de inscripciones (competition_entries) para esta competencia
      const entries = await queryRunner.manager.query(
        `SELECT id FROM competition_entries WHERE competition_id = $1`,
        [id],
      );
      const entryIds = entries.map((e: any) => e.id);

      if (entryIds.length > 0) {
        // 2. Eliminar inspecciones veterinarias asociadas a los registros de tiempo de estas inscripciones
        await queryRunner.manager.query(
          `DELETE FROM vet_inspections WHERE timing_record_id IN (
            SELECT id FROM timing_records WHERE entry_id = ANY($1)
          )`,
          [entryIds],
        );

        // 3. Eliminar los registros de tiempo (timing_records)
        await queryRunner.manager.query(
          `DELETE FROM timing_records WHERE entry_id = ANY($1)`,
          [entryIds],
        );

        // 4. Eliminar los controles de peso (weight_controls)
        await queryRunner.manager.query(
          `DELETE FROM weight_controls WHERE entry_id = ANY($1)`,
          [entryIds],
        );

        // 5. Eliminar las penalizaciones (penalties)
        await queryRunner.manager.query(
          `DELETE FROM penalties WHERE entry_id = ANY($1)`,
          [entryIds],
        );

        // 6. Eliminar las inscripciones (competition_entries)
        await queryRunner.manager.query(
          `DELETE FROM competition_entries WHERE competition_id = $1`,
          [id],
        );
      }

      // 7. Eliminar las etapas (stages)
      await queryRunner.manager.query(
        `DELETE FROM stages WHERE competition_id = $1`,
        [id],
      );

      // 8. Eliminar la competencia principal (competitions)
      await queryRunner.manager.query(
        `DELETE FROM competitions WHERE id = $1`,
        [id],
      );

      await queryRunner.commitTransaction();
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw new BadRequestException(
        `No se pudo eliminar la competencia debido a dependencias: ${error.message}`,
      );
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Da la largada oficial a la competencia bajo reglamento FEU.
   * NOTA DE SEGURIDAD / CUMPLIMIENTO:
   * La validación temporal se realiza de forma duplicada tanto en el Frontend (para guiar la UX y countdown de precisión)
   * como en el Backend (esta función, para garantizar la inmutabilidad y seguridad conforme al reglamento de la FEU).
   */
  async startCompetition(
    id: string,
    officialStartTime?: string,
    confirmWd?: boolean,
  ): Promise<Competition> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. Buscar la competencia con relaciones requeridas
      const competition = await queryRunner.manager.findOne(Competition, {
        where: { id },
        relations: ["stages", "tenant"],
      });

      if (!competition) {
        throw new NotFoundException("Competencia no encontrada.");
      }

      // 2. Idempotencia y validación de estado actual
      if (
        competition.status === CompetitionStatus.ACTIVE ||
        competition.status === CompetitionStatus.COMPLETED
      ) {
        throw new ConflictException(
          `La competencia ya se encuentra en estado ${competition.status}.`,
        );
      }

      if (competition.status !== CompetitionStatus.PLANNED) {
        throw new BadRequestException(
          `La competencia no se puede largar. Estado actual: ${competition.status} (Requerido: PLANNED)`,
        );
      }

      // 3. Validación Temporal (Reglamentaria FEU)
      // Formateador en zona horaria oficial uruguaya (America/Montevideo / GMT-3)
      const formatter = new Intl.DateTimeFormat("en-US", {
        timeZone: "America/Montevideo",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      });

      // Obtener fecha y hora real actual del servidor
      const realNow = new Date();
      const realParts = formatter.formatToParts(realNow);
      const getRealVal = (type: string) => realParts.find((p) => p.type === type).value;
      const realServerTodayStr = `${getRealVal("year")}-${getRealVal("month")}-${getRealVal("day")}`;
      const realServerHour = parseInt(getRealVal("hour"), 10);
      const realServerMinute = parseInt(getRealVal("minute"), 10);

      // Obtener fecha y hora oficial de largada que se desea registrar
      const startTimestamp = officialStartTime
        ? new Date(officialStartTime)
        : realNow;
      const officialParts = formatter.formatToParts(startTimestamp);
      const getOfficialVal = (type: string) => officialParts.find((p) => p.type === type).value;
      const officialTodayStr = `${getOfficialVal("year")}-${getOfficialVal("month")}-${getOfficialVal("day")}`;
      const officialHour = parseInt(getOfficialVal("hour"), 10);
      const officialMinute = parseInt(getOfficialVal("minute"), 10);

      // Formatear la fecha de la competencia
      const getLocalDateString = (d: any): string => {
        if (!d) return "";
        if (typeof d === "string") return d.substring(0, 10);
        const year = d.getUTCFullYear();
        const month = String(d.getUTCMonth() + 1).padStart(2, "0");
        const day = String(d.getUTCDate()).padStart(2, "0");
        return `${year}-${month}-${day}`;
      };

      const compDateStr = getLocalDateString(competition.competitionDate);

      // Validación de Fecha Real del Servidor
      if (compDateStr !== realServerTodayStr) {
        throw new BadRequestException(
          `LARGADA DENEGADA (Reglamento FEU): La carrera está programada para la fecha ${compDateStr}, pero hoy en Uruguay es ${realServerTodayStr}. No se permiten largadas en fechas incorrectas.`,
        );
      }

      // Validación de la fecha oficial seleccionada
      if (compDateStr !== officialTodayStr) {
        throw new BadRequestException(
          `LARGADA DENEGADA (Reglamento FEU): La fecha de largada oficial seleccionada (${officialTodayStr}) debe coincidir con la fecha de la competencia (${compDateStr}).`,
        );
      }

      // Validación de Hora de Largada Programada (Dynamic "Hora Cero" FEU)
      const timeParts = (competition.startTime || "07:00:00").split(":");
      const scheduledHour = parseInt(timeParts[0], 10);
      const scheduledMinute = parseInt(timeParts[1], 10);
      const scheduledMinutes = scheduledHour * 60 + scheduledMinute;

      // 1) Verificar que la hora real actual del servidor ya haya alcanzado la hora programada
      const realCurrentMinutes = realServerHour * 60 + realServerMinute;
      if (realCurrentMinutes < scheduledMinutes) {
        throw new BadRequestException(
          `LARGADA DENEGADA (Reglamento FEU): Faltan minutos para la hora programada de largada (${competition.startTime || "07:00:00"}). Hora actual del servidor en Uruguay: ${getRealVal("hour")}:${getRealVal("minute")}:${getRealVal("second")}.`,
        );
      }

      // 2) Verificar que la hora de largada oficial que se quiere registrar no sea anterior a la programada
      const officialMinutes = officialHour * 60 + officialMinute;
      if (officialMinutes < scheduledMinutes) {
        throw new BadRequestException(
          `LARGADA DENEGADA (Reglamento FEU): La hora oficial de largada seleccionada (${getOfficialVal("hour")}:${getOfficialVal("minute")}:${getOfficialVal("second")}) no puede ser anterior a la hora programada de largada (${competition.startTime || "07:00:00"}).`,
        );
      }

      // 4. Obtener la primera etapa
      if (!competition.stages || competition.stages.length === 0) {
        throw new BadRequestException(
          "La competencia no tiene etapas configuradas para registrar la largada.",
        );
      }

      const stages = [...competition.stages].sort(
        (a, b) => a.stageNumber - b.stageNumber,
      );
      const firstStage = stages[0];

      // 5. Prevención de Duplicados (Asegurar que no se creen múltiples START si se dispara la acción en paralelo)
      const existingStart = await queryRunner.manager.findOne(TimingRecord, {
        where: {
          stage: { id: firstStage.id },
          recordType: TimeRecordType.START,
        },
      });

      if (existingStart) {
        throw new ConflictException(
          "La largada oficial ya ha sido registrada previamente para esta competencia.",
        );
      }

      // 6. Obtener inscripciones activas (binomios en carrera / habilitados)
      const entries = await queryRunner.manager.find(CompetitionEntry, {
        where: { competition: { id: competition.id } },
        relations: ["rider", "horse"],
      });

      if (entries.length === 0) {
        throw new BadRequestException(
          "LARGADA DENEGADA: La competencia no tiene binomios inscritos.",
        );
      }

      // Filtrar los binomios activos que van a largar (status: IN_RACE)
      const activeEntries = entries.filter(
        (entry) => entry.status === ParticipantStatus.IN_RACE,
      );

      if (activeEntries.length === 0) {
        throw new BadRequestException(
          "LARGADA DENEGADA: No hay binomios activos habilitados para iniciar la carrera.",
        );
      }

      // Validar que todos los binomios activos hayan completado la marcación (precinto y pesaje)
      const rules = (competition.competitionType as any)?.defaultRules || {};
      const minWeight = Number(rules.min_weight_kg || rules.min_weight || 85);

      const ineligibleEntries: {
        entry: CompetitionEntry;
        reasons: string[];
      }[] = [];

      for (const entry of activeEntries) {
        const reasons: string[] = [];

        if (!entry.weighInAt || !entry.sealNumber || entry.sealNumber.trim() === "") {
          reasons.push("Falta marcación de pesaje o número de precinto.");
        }

        // Si es una competencia federada, también exigimos que jinete y caballo estén activos/habilitados por la FEU y cumplan con el peso
        if (competition.isFederated) {
          if (!entry.rider?.isFeuActive) {
            reasons.push("El jinete no está activo en la FEU.");
          }
          if (!entry.horse?.isFeuActive) {
            reasons.push("El caballo no está activo en la FEU.");
          }
          const totalWeight = Number(entry.ballastWeight || 0);
          if (totalWeight < minWeight) {
            reasons.push(
              `El peso marcado (${totalWeight} Kg) es menor al mínimo reglamentario (${minWeight} Kg).`,
            );
          }
        }

        if (reasons.length > 0) {
          ineligibleEntries.push({ entry, reasons });
        }
      }

      if (ineligibleEntries.length > 0) {
        if (!confirmWd) {
          const missingCompetitors = ineligibleEntries.map((item) => ({
            id: item.entry.id,
            bibNumber: item.entry.bibNumber,
            riderName: item.entry.rider?.name || "Jinete Desconocido",
            horseName: item.entry.horse?.name || "Caballo Desconocido",
            reasons: item.reasons,
          }));

          throw new BadRequestException({
            message: "LARGADA_PENDIENTE_CONFIRMACION",
            description:
              "Hay competidores que no cumplen con los requisitos mínimos para largar la competencia.",
            missingCompetitors,
          });
        } else {
          // Cambiar automáticamente el estado a WD para los binomios no aptos
          for (const item of ineligibleEntries) {
            item.entry.status = ParticipantStatus.WD;
            await queryRunner.manager.save(CompetitionEntry, item.entry);
          }

          // Filtrar de activeEntries los que ahora cambiamos a WD
          const activeAfterWd = activeEntries.filter(
            (ae) => !ineligibleEntries.some((ie) => ie.entry.id === ae.id),
          );

          if (activeAfterWd.length === 0) {
            throw new BadRequestException(
              "LARGADA DENEGADA: Todos los binomios activos han sido cambiados a WD por no cumplir los requisitos para largar. No quedan competidores habilitados.",
            );
          }

          // Actualizar activeEntries con los que realmente van a largar
          activeEntries.length = 0;
          activeEntries.push(...activeAfterWd);
        }
      }

      // 7. Actualizar estado de la carrera a ACTIVE y registrar hora oficial
      competition.status = CompetitionStatus.ACTIVE;

      const hours = getOfficialVal("hour");
      const minutes = getOfficialVal("minute");
      const seconds = getOfficialVal("second");
      competition.startTime = `${hours}:${minutes}:${seconds}`;

      await queryRunner.manager.save(Competition, competition);

      // 8. Crear registros oficiales TimingRecord de tipo START para todos los binomios activos y actualizar su etapa actual
      const startRecords = [];
      for (const entry of entries) {
        if (entry.status === ParticipantStatus.IN_RACE) {
          const startRecord = queryRunner.manager.create(TimingRecord, {
            tenant: competition.tenant,
            entry: entry,
            stage: firstStage,
            recordType: TimeRecordType.START,
            recordedAt: startTimestamp,
            isApproved: true,
          });
          startRecords.push(startRecord);

          // Update currentStage of the entry
          entry.currentStage = firstStage;
          await queryRunner.manager.save(CompetitionEntry, entry);
        }
      }

      if (startRecords.length > 0) {
        await queryRunner.manager.save(TimingRecord, startRecords);
      }

      await queryRunner.commitTransaction();

      // Retornar la competencia actualizada
      return await this.findOne(competition.id);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      if (
        error instanceof NotFoundException ||
        error instanceof ConflictException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      throw new BadRequestException(
        `Error al dar la largada oficial: ${error.message}`,
      );
    } finally {
      await queryRunner.release();
    }
  }
}
