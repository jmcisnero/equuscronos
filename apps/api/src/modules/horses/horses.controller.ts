import { Controller, Get, Post, Body, Patch, Param, Delete, ParseUUIDPipe } from '@nestjs/common';
import { HorsesService } from './horses.service';
import { CreateHorseDto } from './dto/create-horse.dto';
import { UpdateHorseDto } from './dto/update-horse.dto';

@Controller('admin/horses')
export class HorsesController {
  constructor(private readonly horsesService: HorsesService) {}

  @Post()
  create(@Body() createHorseDto: CreateHorseDto) { return this.horsesService.create(createHorseDto); }

  @Get()
  findAll() { return this.horsesService.findAll(); }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) { return this.horsesService.findOne(id); }

  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() updateHorseDto: UpdateHorseDto) {
    return this.horsesService.update(id, updateHorseDto);
  }

  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string) { return this.horsesService.remove(id); }
}
