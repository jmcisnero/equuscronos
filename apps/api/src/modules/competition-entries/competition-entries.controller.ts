import { Controller, Get, Post, Body, Patch, Param, Delete, ParseUUIDPipe, Query } from '@nestjs/common';
import { CompetitionEntriesService } from './competition-entries.service';
import { CreateCompetitionEntryDto } from './dto/create-competition-entry.dto';
import { UpdateCompetitionEntryDto } from './dto/update-competition-entry.dto';

@Controller('admin/entries')
export class CompetitionEntriesController {
  constructor(private readonly entriesService: CompetitionEntriesService) {}

  @Post()
  create(@Body() dto: CreateCompetitionEntryDto) {
    return this.entriesService.create(dto);
  }

  // Permite filtrar inscripciones por carrera: GET /admin/entries?competitionId=1234
  @Get()
  findAll(@Query('competitionId', ParseUUIDPipe) competitionId: string) {
    return this.entriesService.findAllByCompetition(competitionId);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.entriesService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateCompetitionEntryDto) {
    return this.entriesService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.entriesService.remove(id);
  }
}
