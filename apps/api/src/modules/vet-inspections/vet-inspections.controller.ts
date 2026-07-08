import { Controller, Post, Body } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";
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
}
