import { Controller, Get, Post, Body, Param, ParseUUIDPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { CompetitionsService } from './competitions.service';
import { CreateCompetitionDto } from './dto/create-competition.dto';

@ApiTags('7. Gestión de Carreras (Competitions)')
@ApiBearerAuth('access-token')
@Controller('admin/competitions')
export class CompetitionsController {
  constructor(private readonly competitionsService: CompetitionsService) {}

  @Post()
  @ApiOperation({ summary: 'Crear Carrera completa (Transacción SQL anidada con Etapas)' })
  create(@Body() createCompetitionDto: CreateCompetitionDto) { 
    return this.competitionsService.createCompetitionWithStages(createCompetitionDto); 
  }

  @Get()
  @ApiOperation({ summary: 'Listar todas las carreras planificadas y activas' })
  findAll() { return this.competitionsService.findAll(); }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener detalle de una carrera, incluyendo sus etapas' })
  findOne(@Param('id', ParseUUIDPipe) id: string) { return this.competitionsService.findOne(id); }
}
