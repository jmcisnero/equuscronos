import { Controller, Post, Body, HttpCode, HttpStatus } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiResponse } from "@nestjs/swagger";
import { AuthService } from "./auth.service";
import { LoginDto } from "./dto/login.dto";

@ApiTags("1. Autenticación (Auth)")
@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post("login")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Iniciar sesión con correo y contraseña" })
  @ApiResponse({
    status: 200,
    description: "Inicio de sesión exitoso, retorna el token JWT",
  })
  @ApiResponse({ status: 401, description: "Credenciales inválidas" })
  login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }
}
