import { Controller, Get, Post, Body, Patch, Param, Delete, ParseUUIDPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { CompetitionTypesService } from './competition-types.service';
import { CreateCompetitionTypeDto } from './dto/create-competition-type.dto';
import { UpdateCompetitionTypeDto } from './dto/update-competition-type.dto';

@ApiTags('6. Reglas y Modalidades (Comp. Types)')
@ApiBearerAuth('access-token')
@Controller('admin/competition-types')
export class CompetitionTypesController {
  constructor(private readonly competitionTypesService: CompetitionTypesService) {}

  @Post()
  @ApiOperation({ summary: 'Crear plantilla de reglas' })
  create(@Body() createCompetitionTypeDto: CreateCompetitionTypeDto) { 
    return this.competitionTypesService.create(createCompetitionTypeDto); 
  }

  @Get()
  @ApiOperation({ summary: 'Listar modalidades' })
  findAll() { return this.competitionTypesService.findAll(); }

  @Get(':id')
  @ApiOperation({ summary: 'Buscar modalidad por ID' })
  findOne(@Param('id', ParseUUIDPipe) id: string) { return this.competitionTypesService.findOne(id); }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar plantilla' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() updateCompetitionTypeDto: UpdateCompetitionTypeDto) {
    return this.competitionTypesService.update(id, updateCompetitionTypeDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar plantilla' })
  remove(@Param('id', ParseUUIDPipe) id: string) { return this.competitionTypesService.remove(id); }
}
