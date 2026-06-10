import { Controller, Get, Post, Body, Param, ParseUUIDPipe, Patch, Delete, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { CompetitionsService } from './competitions.service';
import { CreateCompetitionDto } from './dto/create-competition.dto';
import { UpdateCompetitionDto } from './dto/update-competition.dto';
import { StartCompetitionDto } from './dto/start-competition.dto';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '@equuscronos/shared';

@ApiTags('7. Gestión de Carreras (Competitions)')
@ApiBearerAuth('access-token')
@Roles(UserRole.ADMIN)
@Controller('admin/competitions')
export class CompetitionsController {
  constructor(private readonly competitionsService: CompetitionsService) {}

  @Post()
  @ApiOperation({ summary: 'Crear Carrera completa (Transacción SQL anidada con Etapas)' })
  create(@Body() createCompetitionDto: CreateCompetitionDto) { 
    return this.competitionsService.createCompetitionWithStages(createCompetitionDto); 
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.JUDGE, UserRole.TIMEKEEPER, UserRole.VET)
  @ApiOperation({ summary: 'Listar todas las carreras planificadas y activas' })
  findAll() { return this.competitionsService.findAll(); }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.JUDGE, UserRole.TIMEKEEPER, UserRole.VET)
  @ApiOperation({ summary: 'Obtener detalle de una carrera, incluyendo sus etapas' })
  findOne(@Param('id', ParseUUIDPipe) id: string) { return this.competitionsService.findOne(id); }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar configuración de una competencia (Ej: Pulsaciones)' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() updateDto: UpdateCompetitionDto) {
    return this.competitionsService.update(id, updateDto);
  }  

  @Post(':id/start')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, 'ORGANIZER')
  @ApiOperation({ summary: 'Dar largada oficial de la carrera bajo reglamento FEU' })
  startCompetition(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() startDto: StartCompetitionDto,
  ) {
    return this.competitionsService.startCompetition(id, startDto.officialStartTime);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar una competencia y todas sus relaciones en cascada' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.competitionsService.remove(id);
  }
}
