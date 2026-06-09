import { Controller, Get, Post, Body, Patch, Param, Delete, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { RidersService } from './riders.service';
import { CreateRiderDto } from './dto/create-rider.dto';
import { UpdateRiderDto } from './dto/update-rider.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '@equuscronos/shared';

@ApiTags('5. Padrón Jinetes (Riders)')
@ApiBearerAuth('access-token')
@Controller('admin/riders')
export class RidersController {
  constructor(private readonly ridersService: RidersService) {}

  @Post()
  @ApiOperation({ summary: 'Registrar jinete' })
  create(@Body() createRiderDto: CreateRiderDto) { return this.ridersService.create(createRiderDto); }

  @Get()
  @ApiOperation({ summary: 'Listar todos los jinetes con búsqueda global' })
  findAll(@Query('search') search?: string) { return this.ridersService.findAll(search); }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener jinete por ID' })
  findOne(@Param('id', ParseUUIDPipe) id: string) { return this.ridersService.findOne(id); }

  @Patch(':id')
  @ApiOperation({ summary: 'Modificar datos del jinete' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() updateRiderDto: UpdateRiderDto) {
    return this.ridersService.update(id, updateRiderDto);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Eliminar jinete' })
  remove(@Param('id', ParseUUIDPipe) id: string) { return this.ridersService.remove(id); }
}
