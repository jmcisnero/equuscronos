import { Controller, Post, Get, Delete, Param, Body, Query, ParseUUIDPipe } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from "@nestjs/swagger";
import { VetInspectionsService } from "./vet-inspections.service";
import { CreateVetInspectionDto } from "./dto/create-vet-inspection.dto";
import { Roles } from "../auth/decorators/roles.decorator";
import { UserRole } from "@equuscronos/shared";

@ApiTags("Clínica Veterinaria (Vet Inspections)")
@ApiBearerAuth("access-token")
@Roles(UserRole.VET, UserRole.ADMIN)
@Controller("vet-inspections")
export class VetInspectionsController {
  constructor(private readonly vetInspectionsService: VetInspectionsService) {}

  @Get("pending")
  @Roles(
    UserRole.ADMIN,
    UserRole.CLUB_ADMIN,
    UserRole.JUDGE,
    UserRole.TIMEKEEPER,
    UserRole.VET,
  )
  @ApiOperation({ summary: "Obtener competidores pendientes de inspección veterinaria (con VET_IN registrado)" })
  @ApiQuery({ name: "competitionId", required: true, description: "UUID de la carrera" })
  @ApiQuery({ name: "stageNumber", required: false, description: "Número de etapa (opcional)" })
  async getPending(
    @Query("competitionId", ParseUUIDPipe) competitionId: string,
    @Query("stageNumber") stageNumber?: string,
  ) {
    const stageNum = stageNumber ? parseInt(stageNumber, 10) : undefined;
    return await this.vetInspectionsService.getPendingForVetGate(
      competitionId,
      stageNum,
    );
  }

  @Post()
  @ApiOperation({ summary: "Registrar formulario clínico veterinario" })
  async create(@Body() createVetInspectionDto: CreateVetInspectionDto) {
    try {
      return await this.vetInspectionsService.create(createVetInspectionDto);
    } catch (err) {
      console.error("[VetInspectionController Error]:", err);
      throw err;
    }
  }

  @Delete(":id")
  @Roles(
    UserRole.ADMIN,
    UserRole.CLUB_ADMIN,
    UserRole.JUDGE,
    UserRole.VET,
  )
  @ApiOperation({ summary: "Eliminar / Deshacer último registro de inspección veterinaria" })
  async delete(@Param("id", ParseUUIDPipe) id: string) {
    try {
      return await this.vetInspectionsService.deleteLastInspection(id);
    } catch (err) {
      console.error("[VetInspectionController Delete Error]:", err);
      throw err;
    }
  }
}

