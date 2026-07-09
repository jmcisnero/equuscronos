import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  ParseUUIDPipe,
  Query,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";
import { OwnersService } from "./owners.service";
import { CreateOwnerDto } from "./dto/create-owner.dto";
import { UpdateOwnerDto } from "./dto/update-owner.dto";

import { Roles } from "../auth/decorators/roles.decorator";
import { UserRole } from "@equuscronos/shared";

@ApiTags("2. Propietarios (Owners)")
@ApiBearerAuth("access-token")
@Roles(UserRole.ADMIN, UserRole.CLUB_ADMIN, UserRole.JUDGE)
@Controller("admin/owners")
export class OwnersController {
  constructor(private readonly ownersService: OwnersService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.CLUB_ADMIN)
  @ApiOperation({ summary: "Registrar nuevo propietario" })
  create(@Body() createOwnerDto: CreateOwnerDto) {
    return this.ownersService.create(createOwnerDto);
  }

  @Get()
  @ApiOperation({
    summary: "Listar padrón de propietarios con búsqueda por texto",
  })
  findAll(@Query("search") search?: string) {
    return this.ownersService.findAll(search);
  }

  @Get(":id")
  @ApiOperation({ summary: "Obtener propietario por ID" })
  findOne(@Param("id", ParseUUIDPipe) id: string) {
    return this.ownersService.findOne(id);
  }

  @Patch(":id")
  @Roles(UserRole.ADMIN, UserRole.CLUB_ADMIN)
  @ApiOperation({ summary: "Modificar propietario" })
  update(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() updateOwnerDto: UpdateOwnerDto,
  ) {
    return this.ownersService.update(id, updateOwnerDto);
  }

  @Delete(":id")
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: "Eliminar propietario" })
  remove(@Param("id", ParseUUIDPipe) id: string) {
    return this.ownersService.remove(id);
  }
}
