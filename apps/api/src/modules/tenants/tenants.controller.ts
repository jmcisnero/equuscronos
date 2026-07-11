import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  ParseUUIDPipe,
  UseInterceptors,
  UploadedFile,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";
import { TenantsService } from "./tenants.service";
import { CreateTenantDto } from "./dto/create-tenant.dto";
import { UpdateTenantDto } from "./dto/update-tenant.dto";
import { FileInterceptor } from "@nestjs/platform-express";

import { Roles } from "../auth/decorators/roles.decorator";
import { UserRole } from "@equuscronos/shared";

@ApiTags("1. Clubes / Organizaciones (Tenants)")
@ApiBearerAuth("access-token")
@Roles(UserRole.ADMIN, UserRole.CLUB_ADMIN, UserRole.JUDGE)
@Controller("admin/tenants")
export class TenantsController {
  constructor(private readonly tenantsService: TenantsService) {}

  @Post()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: "Registrar un nuevo club" })
  create(@Body() createTenantDto: CreateTenantDto) {
    return this.tenantsService.create(createTenantDto);
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.CLUB_ADMIN, UserRole.JUDGE)
  @ApiOperation({ summary: "Listar todos los clubes" })
  findAll() {
    return this.tenantsService.findAll();
  }

  @Get(":id")
  @Roles(UserRole.ADMIN, UserRole.CLUB_ADMIN, UserRole.JUDGE)
  @ApiOperation({ summary: "Obtener club por ID" })
  findOne(@Param("id", ParseUUIDPipe) id: string) {
    return this.tenantsService.findOne(id);
  }

  @Patch(":id")
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: "Modificar datos de un club" })
  update(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() updateTenantDto: UpdateTenantDto,
  ) {
    return this.tenantsService.update(id, updateTenantDto);
  }

  @Delete(":id")
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: "Eliminar un club" })
  remove(@Param("id", ParseUUIDPipe) id: string) {
    return this.tenantsService.remove(id);
  }

  @Post(":id/upload-jersey")
  @Roles(UserRole.ADMIN, UserRole.CLUB_ADMIN)
  @UseInterceptors(FileInterceptor("file"))
  @ApiOperation({ summary: "Subir imagen de la camiseta del club" })
  uploadJersey(
    @Param("id", ParseUUIDPipe) id: string,
    @UploadedFile() file: any,
  ) {
    return this.tenantsService.uploadJersey(id, file);
  }
}
