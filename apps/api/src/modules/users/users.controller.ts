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
  ClassSerializerInterceptor,
  Request,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";
import { UsersService } from "./users.service";
import { CreateUserDto } from "./dto/create-user.dto";
import { UpdateUserDto } from "./dto/update-user.dto";

import { Roles } from "../auth/decorators/roles.decorator";
import { UserRole } from "@equuscronos/shared";

@ApiTags("3. Usuarios y Roles (Users)")
@ApiBearerAuth("access-token")
@UseInterceptors(ClassSerializerInterceptor)
@Roles(UserRole.ADMIN, UserRole.CLUB_ADMIN)
@Controller("admin/users")
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @ApiOperation({ summary: "Crear cuenta de usuario/staff" })
  create(@Body() createUserDto: CreateUserDto, @Request() req) {
    return this.usersService.create(createUserDto, req.user);
  }

  @Get()
  @ApiOperation({ summary: "Listar todos los usuarios" })
  findAll() {
    return this.usersService.findAll();
  }

  @Get(":id")
  @ApiOperation({ summary: "Obtener usuario por ID" })
  findOne(@Param("id", ParseUUIDPipe) id: string) {
    return this.usersService.findOne(id);
  }

  @Patch(":id")
  @ApiOperation({ summary: "Actualizar cuenta de usuario" })
  update(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() updateUserDto: UpdateUserDto,
    @Request() req,
  ) {
    return this.usersService.update(id, updateUserDto, req.user);
  }

  @Delete(":id")
  @ApiOperation({ summary: "Revocar acceso (Eliminar usuario)" })
  remove(@Param("id", ParseUUIDPipe) id: string) {
    return this.usersService.remove(id);
  }
}
