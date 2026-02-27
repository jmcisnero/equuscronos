import { Controller, Get, Post, Body, Patch, Param, Delete, ParseUUIDPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { RidersService } from './riders.service';
import { CreateRiderDto } from './dto/create-rider.dto';
import { UpdateRiderDto } from './dto/update-rider.dto';

@ApiTags('5. Padrón Jinetes (Riders)')
@ApiBearerAuth('access-token')
@Controller('admin/riders')
export class RidersController {
  constructor(private readonly ridersService: RidersService) {}

  @Post()
  @ApiOperation({ summary: 'Registrar jinete' })
  create(@Body() createRiderDto: CreateRiderDto) { return this.ridersService.create(createRiderDto); }

  @Get()
  @ApiOperation({ summary: 'Listar todos los jinetes' })
  findAll() { return this.ridersService.findAll(); }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener jinete por ID' })
  findOne(@Param('id', ParseUUIDPipe) id: string) { return this.ridersService.findOne(id); }

  @Patch(':id')
  @ApiOperation({ summary: 'Modificar datos del jinete' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() updateRiderDto: UpdateRiderDto) {
    return this.ridersService.update(id, updateRiderDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar jinete' })
  remove(@Param('id', ParseUUIDPipe) id: string) { return this.ridersService.remove(id); }
}
