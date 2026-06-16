import {
  Controller,
  Post,
  Patch,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  BadRequestException,
  Headers,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
} from "@nestjs/swagger";
import { TimingService } from "./timing.service";
import { CreateTimingRecordDto } from "./dto/create-timing.dto";
import { VoidTimingRecordDto } from "./dto/void-timing.dto";
import { UpdateTimingRecordDto } from "./dto/update-timing.dto";
import { TimeRecordType, UserRole, EliminationCode } from "@equuscronos/shared";
import { Roles } from "../auth/decorators/roles.decorator";

@ApiTags("9. Cronometraje (Motor de Pista - Field App)")
@ApiBearerAuth("access-token")
@Roles(UserRole.TIMEKEEPER, UserRole.JUDGE)
@Controller("timing")
export class TimingController {
  constructor(private readonly timingService: TimingService) {}

  @Post("vet-in")
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: "Registrar entrada veterinaria (VET_IN)" })
  @ApiResponse({ status: 201, description: "VET_IN registrado." })
  async createVetIn(@Body() createTimingRecordDto: CreateTimingRecordDto) {
    createTimingRecordDto.recordType = TimeRecordType.VET_IN;
    const record = await this.timingService.create(createTimingRecordDto);
    return {
      id: record.id,
      recordType: record.recordType,
      recordedAt: record.recordedAt,
      isApproved: record.isApproved,
      eliminationType: record.eliminationType,
      eliminationReason: record.eliminationReason,
      eliminated:
        !record.isApproved && record.eliminationType === EliminationCode.TIME,
    };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: "FUEGO RÁPIDO: Registrar lectura de meta o control veterinario",
  })
  @ApiResponse({ status: 201, description: "Tiempo guardado exitosamente." })
  @ApiResponse({
    status: 400,
    description: "Bad Request: Faltan datos o el competidor ya está DQ.",
  })
  @ApiResponse({
    status: 404,
    description: "Not Found: Dorsal/Chip no encontrado en esta carrera.",
  })
  async createRecord(@Body() createTimingRecordDto: CreateTimingRecordDto) {
    if (createTimingRecordDto.recordType === TimeRecordType.START) {
      throw new BadRequestException(
        "El registro de inicio (START) no está permitido a través de este endpoint. Utilice la consola de administración.",
      );
    }
    return await this.timingService.create(createTimingRecordDto);
  }

  @Patch(":id")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Actualizar un registro de tiempo existente" })
  @ApiResponse({ status: 200, description: "Tiempo actualizado exitosamente." })
  @ApiResponse({
    status: 400,
    description: "Bad Request: Acción inválida o fuera de etapa.",
  })
  @ApiResponse({
    status: 404,
    description: "Not Found: Registro no encontrado.",
  })
  async updateRecord(
    @Param("id") id: string,
    @Body() updateTimingRecordDto: UpdateTimingRecordDto,
    @Headers("x-role") userRole?: string,
  ) {
    return await this.timingService.updateRecord(
      id,
      updateTimingRecordDto.recordedAt,
      userRole,
    );
  }

  @Patch(":id/void")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Anular un registro de tiempo con justificación obligatoria",
  })
  @ApiResponse({ status: 200, description: "Tiempo anulado exitosamente." })
  @ApiResponse({
    status: 400,
    description: "Bad Request: El registro ya estaba anulado.",
  })
  @ApiResponse({
    status: 404,
    description: "Not Found: Registro no encontrado.",
  })
  async voidRecord(
    @Param("id") id: string,
    @Body() voidTimingRecordDto: VoidTimingRecordDto,
    @Headers("x-role") userRole?: string,
  ) {
    return await this.timingService.void(
      id,
      voidTimingRecordDto.voidReason,
      userRole,
    );
  }
}
