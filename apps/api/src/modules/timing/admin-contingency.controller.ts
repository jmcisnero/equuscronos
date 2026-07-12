import {
  Controller,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from "@nestjs/swagger";
import { AdminContingencyService } from "./admin-contingency.service";
import { Roles } from "../auth/decorators/roles.decorator";
import { UserRole, GaitStatus } from "@equuscronos/shared";

@ApiTags("10. Contingencia Administrativa (Sólo Admin)")
@ApiBearerAuth("access-token")
@Roles(UserRole.ADMIN)
@Controller("admin/contingency")
export class AdminContingencyController {
  constructor(private readonly contingencyService: AdminContingencyService) {}

  // ==========================================
  // TIMING RECORD ENDPOINTS
  // ==========================================

  @Patch("timing-records/:id")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Modificar fecha/hora de un paso de tiempo (Solo ADMIN)" })
  @ApiResponse({ status: 200, description: "Paso de tiempo actualizado." })
  async updateTimingRecord(
    @Param("id", ParseUUIDPipe) id: string,
    @Body("recordedAt") recordedAt: string,
  ) {
    if (!recordedAt) {
      throw new Error("El campo recordedAt es obligatorio.");
    }
    return await this.contingencyService.updateTimingRecord(id, recordedAt);
  }

  @Delete("timing-records/:id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Eliminar físicamente un paso de tiempo (Solo ADMIN)" })
  @ApiResponse({ status: 204, description: "Paso de tiempo eliminado." })
  async deleteTimingRecord(@Param("id", ParseUUIDPipe) id: string) {
    await this.contingencyService.deleteTimingRecord(id);
  }

  // ==========================================
  // VET INSPECTION ENDPOINTS
  // ==========================================

  @Patch("vet-inspections/:id")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Modificar datos de un control veterinario (Solo ADMIN)" })
  @ApiResponse({ status: 200, description: "Control veterinario actualizado." })
  async updateVetInspection(
    @Param("id", ParseUUIDPipe) id: string,
    @Body("heartRate") heartRate: number,
    @Body("gaitStatus") gaitStatus: GaitStatus,
    @Body("notes") notes?: string,
  ) {
    if (heartRate === undefined || !gaitStatus) {
      throw new Error("Los campos heartRate y gaitStatus son obligatorios.");
    }
    return await this.contingencyService.updateVetInspection(
      id,
      heartRate,
      gaitStatus,
      notes,
    );
  }

  @Delete("vet-inspections/:id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Eliminar un control veterinario (Solo ADMIN)" })
  @ApiResponse({ status: 204, description: "Control veterinario eliminado." })
  async deleteVetInspection(@Param("id", ParseUUIDPipe) id: string) {
    await this.contingencyService.deleteVetInspection(id);
  }

  // ==========================================
  // PENALTY ENDPOINTS
  // ==========================================

  @Post("penalties")
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: "Crear una nueva penalización de tiempo (Solo ADMIN)" })
  @ApiResponse({ status: 201, description: "Penalización creada." })
  async createPenalty(
    @Body("entryId", ParseUUIDPipe) entryId: string,
    @Body("stageId", ParseUUIDPipe) stageId: string,
    @Body("timePenaltySeconds") timePenaltySeconds: number,
    @Body("reason") reason: string,
  ) {
    if (!entryId || !stageId || timePenaltySeconds === undefined || !reason) {
      throw new Error("Todos los campos (entryId, stageId, timePenaltySeconds, reason) son obligatorios.");
    }
    return await this.contingencyService.createPenalty(
      entryId,
      stageId,
      timePenaltySeconds,
      reason,
    );
  }

  @Patch("penalties/:id")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Modificar una penalización existente (Solo ADMIN)" })
  @ApiResponse({ status: 200, description: "Penalización actualizada." })
  async updatePenalty(
    @Param("id", ParseUUIDPipe) id: string,
    @Body("timePenaltySeconds") timePenaltySeconds: number,
    @Body("reason") reason: string,
  ) {
    if (timePenaltySeconds === undefined || !reason) {
      throw new Error("Los campos timePenaltySeconds y reason son obligatorios.");
    }
    return await this.contingencyService.updatePenalty(id, timePenaltySeconds, reason);
  }

  @Delete("penalties/:id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Eliminar una penalización (Solo ADMIN)" })
  @ApiResponse({ status: 204, description: "Penalización eliminada." })
  async deletePenalty(@Param("id", ParseUUIDPipe) id: string) {
    await this.contingencyService.deletePenalty(id);
  }
}
