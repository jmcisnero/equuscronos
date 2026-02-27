import { Controller, Get, Post, Body, Patch, Param, Delete, ParseUUIDPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { HorsesService } from './horses.service';
import { CreateHorseDto } from './dto/create-horse.dto';
import { UpdateHorseDto } from './dto/update-horse.dto';

@ApiTags('4. Padrón Equino (Horses)')
@ApiBearerAuth('access-token')
@Controller('admin/horses')
export class HorsesController {
  constructor(private readonly horsesService: HorsesService) {}

  @Post()
  @ApiOperation({ summary: 'Dar de alta un caballo' })
  create(@Body() createHorseDto: CreateHorseDto) { return this.horsesService.create(createHorseDto); }

  @Get()
  @ApiOperation({ summary: 'Listar padrón de caballos' })
  findAll() { return this.horsesService.findAll(); }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener caballo por ID' })
  findOne(@Param('id', ParseUUIDPipe) id: string) { return this.horsesService.findOne(id); }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar ficha del caballo' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() updateHorseDto: UpdateHorseDto) {
    return this.horsesService.update(id, updateHorseDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar caballo' })
  remove(@Param('id', ParseUUIDPipe) id: string) { return this.horsesService.remove(id); }
}
