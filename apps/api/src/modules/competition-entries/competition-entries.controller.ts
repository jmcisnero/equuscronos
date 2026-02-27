import { Controller, Get, Post, Body, Patch, Param, Delete, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { CompetitionEntriesService } from './competition-entries.service';
import { CreateCompetitionEntryDto } from './dto/create-competition-entry.dto';
import { UpdateCompetitionEntryDto } from './dto/update-competition-entry.dto';

@ApiTags('8. Inscripciones / Binomios (Entries)')
@ApiBearerAuth('access-token')
@Controller('admin/entries')
export class CompetitionEntriesController {
  constructor(private readonly entriesService: CompetitionEntriesService) {}

  @Post()
  @ApiOperation({ summary: 'Inscribir un Binomio (Asignar Dorsal)' })
  create(@Body() createCompetitionEntryDto: CreateCompetitionEntryDto) { 
    return this.entriesService.create(createCompetitionEntryDto); 
  }

  @Get()
  @ApiOperation({ summary: 'Obtener la Start List de una Carrera' })
  @ApiQuery({ name: 'competitionId', required: true, description: 'UUID de la carrera' })
  findAll(@Query('competitionId', ParseUUIDPipe) competitionId: string) { 
    return this.entriesService.findAllByCompetition(competitionId); 
  }

  @Get(':id')
  @ApiOperation({ summary: 'Ver detalles de la inscripción de un dorsal' })
  findOne(@Param('id', ParseUUIDPipe) id: string) { return this.entriesService.findOne(id); }

  @Patch(':id')
  @ApiOperation({ summary: 'Modificar pesaje o estado de un competidor' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() updateCompetitionEntryDto: UpdateCompetitionEntryDto) {
    return this.entriesService.update(id, updateCompetitionEntryDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Dar de baja una inscripción (Retiro previo a largar)' })
  remove(@Param('id', ParseUUIDPipe) id: string) { return this.entriesService.remove(id); }
}
