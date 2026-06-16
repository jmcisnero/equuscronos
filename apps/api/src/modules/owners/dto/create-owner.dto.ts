import { IsString, IsNotEmpty, IsOptional, IsEnum } from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { OwnerType } from "@equuscronos/shared";

export class CreateOwnerDto {
  @ApiProperty({
    description: "Nombre completo de la persona, o nombre del Stud/Haras",
    example: "Haras El Relincho",
  })
  @IsString({
    message: "El nombre completo o razón social debe ser un texto válido.",
  })
  @IsNotEmpty({ message: "El nombre completo o razón social es obligatorio." })
  name: string;

  @ApiPropertyOptional({
    description: "Categoría del propietario",
    enum: OwnerType,
    example: OwnerType.INDIVIDUAL,
    default: OwnerType.INDIVIDUAL,
  })
  @IsOptional()
  @IsEnum(OwnerType, {
    message:
      "La categoría seleccionada no es válida. Elija Persona Física, Stud o Haras.",
  })
  type?: OwnerType;

  @ApiPropertyOptional({
    description: "Teléfono o email de contacto",
    example: "contacto@elrelincho.uy",
  })
  @IsOptional()
  @IsString({ message: "La información de contacto debe ser un texto válido." })
  contactInfo?: string;
}
