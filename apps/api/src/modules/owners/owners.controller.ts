import { Controller, Get, Post, Body, Patch, Param, Delete, ParseUUIDPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { OwnersService } from './owners.service';
import { CreateOwnerDto } from './dto/create-owner.dto';
import { UpdateOwnerDto } from './dto/update-owner.dto';

@ApiTags('2. Propietarios (Owners)')
@ApiBearerAuth('access-token')
@Controller('admin/owners')
export class OwnersController {
  constructor(private readonly ownersService: OwnersService) {}

  @Post()
  @ApiOperation({ summary: 'Registrar nuevo propietario' })
  create(@Body() createOwnerDto: CreateOwnerDto) { return this.ownersService.create(createOwnerDto); }

  @Get()
  @ApiOperation({ summary: 'Listar padrón de propietarios' })
  findAll() { return this.ownersService.findAll(); }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener propietario por ID' })
  findOne(@Param('id', ParseUUIDPipe) id: string) { return this.ownersService.findOne(id); }

  @Patch(':id')
  @ApiOperation({ summary: 'Modificar propietario' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() updateOwnerDto: UpdateOwnerDto) {
    return this.ownersService.update(id, updateOwnerDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar propietario' })
  remove(@Param('id', ParseUUIDPipe) id: string) { return this.ownersService.remove(id); }
}
