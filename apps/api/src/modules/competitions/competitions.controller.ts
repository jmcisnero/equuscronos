import { Controller, Get, Post, Body, Param, ParseUUIDPipe } from '@nestjs/common';
import { CompetitionsService } from './competitions.service';
import { CreateCompetitionDto } from './dto/create-competition.dto';

@Controller('admin/competitions')
export class CompetitionsController {
  constructor(private readonly competitionsService: CompetitionsService) {}

  @Post()
  async create(@Body() createCompetitionDto: CreateCompetitionDto) {
    return this.competitionsService.createCompetitionWithStages(createCompetitionDto);
  }

  @Get()
  async findAll() {
    return this.competitionsService.findAll();
  }

  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.competitionsService.findOne(id);
  }
}
