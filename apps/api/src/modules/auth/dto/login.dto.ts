import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsNotEmpty } from "class-validator";

export class LoginDto {
  @ApiProperty({
    example: "admin@equuscronos.com",
    description: "Correo electrónico",
  })
  @IsEmail({}, { message: "El correo electrónico debe ser válido" })
  @IsNotEmpty({ message: "El correo electrónico es obligatorio" })
  email: string;

  @ApiProperty({ example: "admin123", description: "Contraseña" })
  @IsNotEmpty({ message: "La contraseña es obligatoria" })
  password: string;
}
