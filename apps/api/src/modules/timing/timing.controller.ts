import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { TimingService } from './timing.service';
import { CreateTimingRecordDto } from './dto/create-timing.dto';

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
    return await this.timingService.processRapidFireRecord(createTimingRecordDto);
  }
}
