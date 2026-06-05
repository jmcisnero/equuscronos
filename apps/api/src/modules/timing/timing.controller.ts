import { Controller, Post, Patch, Body, Param, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { TimingService } from './timing.service';
import { CreateTimingRecordDto } from './dto/create-timing.dto';
import { VoidTimingRecordDto } from './dto/void-timing.dto';
import { UpdateTimingRecordDto } from './dto/update-timing.dto';

@ApiTags('9. Cronometraje (Motor de Pista - Field App)')
@ApiBearerAuth('access-token')
@Controller('timing')
export class TimingController {
  constructor(private readonly timingService: TimingService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'FUEGO RÁPIDO: Registrar lectura de meta o control veterinario' })
  @ApiResponse({ status: 201, description: 'Tiempo guardado exitosamente.' })
  @ApiResponse({ status: 400, description: 'Bad Request: Faltan datos o el competidor ya está DQ.' })
  @ApiResponse({ status: 404, description: 'Not Found: Dorsal/Chip no encontrado en esta carrera.' })
  async createRecord(@Body() createTimingRecordDto: CreateTimingRecordDto) {
    return await this.timingService.create(createTimingRecordDto);
  }

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Actualizar un registro de tiempo existente' })
  @ApiResponse({ status: 200, description: 'Tiempo actualizado exitosamente.' })
  @ApiResponse({ status: 400, description: 'Bad Request: Acción inválida o fuera de etapa.' })
  @ApiResponse({ status: 404, description: 'Not Found: Registro no encontrado.' })
  async updateRecord(
    @Param('id') id: string,
    @Body() updateTimingRecordDto: UpdateTimingRecordDto,
  ) {
    return await this.timingService.updateRecord(id, updateTimingRecordDto.recordedAt);
  }

  @Patch(':id/void')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Anular un registro de tiempo con justificación obligatoria' })
  @ApiResponse({ status: 200, description: 'Tiempo anulado exitosamente.' })
  @ApiResponse({ status: 400, description: 'Bad Request: El registro ya estaba anulado.' })
  @ApiResponse({ status: 404, description: 'Not Found: Registro no encontrado.' })
  async voidRecord(
    @Param('id') id: string,
    @Body() voidTimingRecordDto: VoidTimingRecordDto,
  ) {
    return await this.timingService.void(id, voidTimingRecordDto.voidReason);
  }
}

