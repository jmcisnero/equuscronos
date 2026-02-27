import { Controller, Get, Post, Body, Patch, Param, Delete, ParseUUIDPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { TenantsService } from './tenants.service';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';

@ApiTags('1. Clubes / Organizaciones (Tenants)')
@ApiBearerAuth('access-token')
@Controller('admin/tenants')
export class TenantsController {
  constructor(private readonly tenantsService: TenantsService) {}

  @Post()
  @ApiOperation({ summary: 'Registrar un nuevo club' })
  create(@Body() createTenantDto: CreateTenantDto) { return this.tenantsService.create(createTenantDto); }

  @Get()
  @ApiOperation({ summary: 'Listar todos los clubes' })
  findAll() { return this.tenantsService.findAll(); }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener club por ID' })
  findOne(@Param('id', ParseUUIDPipe) id: string) { return this.tenantsService.findOne(id); }

  @Patch(':id')
  @ApiOperation({ summary: 'Modificar datos de un club' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() updateTenantDto: UpdateTenantDto) {
    return this.tenantsService.update(id, updateTenantDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar un club' })
  remove(@Param('id', ParseUUIDPipe) id: string) { return this.tenantsService.remove(id); }
}
