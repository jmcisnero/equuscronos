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
  UseInterceptors,
  UploadedFile,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";
import { HorsesService } from "./horses.service";
import { CreateHorseDto } from "./dto/create-horse.dto";
import { UpdateHorseDto } from "./dto/update-horse.dto";
import { FileInterceptor } from "@nestjs/platform-express";

import { Roles } from "../auth/decorators/roles.decorator";
import { UserRole } from "@equuscronos/shared";

@ApiTags("4. Padrón Equino (Horses)")
@ApiBearerAuth("access-token")
@Roles(UserRole.ADMIN, UserRole.CLUB_ADMIN, UserRole.JUDGE)
@Controller("admin/horses")
export class HorsesController {
  constructor(private readonly horsesService: HorsesService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.CLUB_ADMIN)
  @ApiOperation({ summary: "Dar de alta un caballo" })
  create(@Body() createHorseDto: CreateHorseDto) {
    return this.horsesService.create(createHorseDto);
  }

  @Get()
  @ApiOperation({
    summary: "Listar padrón de caballos con búsqueda unificada (Omni-search)",
  })
  findAll(@Query("q") search?: string) {
    return this.horsesService.findAll(search);
  }

  @Get(":id")
  @ApiOperation({ summary: "Obtener caballo por ID" })
  findOne(@Param("id", ParseUUIDPipe) id: string) {
    return this.horsesService.findOne(id);
  }

  @Patch(":id")
  @Roles(UserRole.ADMIN, UserRole.CLUB_ADMIN)
  @ApiOperation({ summary: "Actualizar ficha del caballo" })
  update(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() updateHorseDto: UpdateHorseDto,
  ) {
    return this.horsesService.update(id, updateHorseDto);
  }

  @Delete(":id")
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: "Eliminar caballo" })
  remove(@Param("id", ParseUUIDPipe) id: string) {
    return this.horsesService.remove(id);
  }

  @Post(":id/upload-photo")
  @Roles(UserRole.ADMIN, UserRole.CLUB_ADMIN)
  @UseInterceptors(FileInterceptor("file"))
  @ApiOperation({ summary: "Subir foto del caballo" })
  uploadPhoto(
    @Param("id", ParseUUIDPipe) id: string,
    @UploadedFile() file: any,
  ) {
    return this.horsesService.uploadPhoto(id, file);
  }
}
