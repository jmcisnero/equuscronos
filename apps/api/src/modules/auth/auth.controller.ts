import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  HttpCode,
  HttpStatus,
  Req,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiResponse } from "@nestjs/swagger";
import { AuthService } from "./auth.service";
import { LoginDto } from "./dto/login.dto";
import {
  GoogleAuthDto,
  AppleAuthDto,
  GuestAuthDto,
  UpdateProfileDto,
} from "./dto/social-auth.dto";

@ApiTags("1. Autenticación (Auth)")
@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post("login")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Iniciar sesión con correo y contraseña (Backoffice)" })
  login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @Post("public/google")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Social Auth con Google para la App Móvil Pública" })
  googleAuth(@Body() dto: GoogleAuthDto) {
    return this.authService.googleAuth(dto);
  }

  @Post("public/apple")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Social Auth con Apple (Sign in with Apple iOS)" })
  appleAuth(@Body() dto: AppleAuthDto) {
    return this.authService.appleAuth(dto);
  }

  @Post("public/guest")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Acceso en Modo Invitado con Progressive Profiling" })
  guestAuth(@Body() dto: GuestAuthDto) {
    return this.authService.guestAuth(dto);
  }

  @Patch("public/profile")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Actualizar preferencias y perfil de usuario público" })
  updateProfile(@Req() req: any, @Body() dto: UpdateProfileDto) {
    return this.authService.updateProfile(req.user.id, dto);
  }
}
