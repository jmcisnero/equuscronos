import { Controller, Get, Post, Body, Param, ParseUUIDPipe, Patch } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { CompetitionsService } from './competitions.service';
import { CreateCompetitionDto } from './dto/create-competition.dto';
import { UpdateCompetitionDto } from './dto/update-competition.dto';

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

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar configuración de una competencia (Ej: Pulsaciones)' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() updateDto: UpdateCompetitionDto) {
    return this.competitionsService.update(id, updateDto);
  }  
}
