import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  IsDateString,
} from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class CreateHorseDto {
  @ApiProperty({
    description: "Nombre oficial deportivo del caballo",
    example: "Tormenta Criolla",
  })
  @IsString({ message: "El nombre del caballo debe ser un texto válido." })
  @IsNotEmpty({ message: "El nombre del caballo es obligatorio." })
  name: string;

  @ApiProperty({
    description: "UUID del propietario legal del caballo",
    example: "b1000000-0000-0000-0000-000000000001",
  })
  @IsString({
    message: "El identificador del propietario debe ser un texto válido.",
  })
  @IsNotEmpty({
    message:
      "El propietario del caballo es obligatorio para garantizar la trazabilidad de los binomios.",
  })
  // El propietario es obligatorio para garantizar la trazabilidad de los binomios y la confección de planillas oficiales de la FEU
  ownerId: string;

  @ApiPropertyOptional({
    description: "Número de pasaporte o carnet federativo (FEU)",
    example: "FEU-H-101",
  })
  @IsOptional()
  @IsString({ message: "El pasaporte FEU debe ser un texto válido." })
  feuId?: string;

  @ApiPropertyOptional({
    description: "Código del microchip RFID para lectura automática",
    example: "CHIP-985121000",
  })
  @IsOptional()
  @IsString({
    message: "El código de microchip RFID debe ser un texto válido.",
  })
  chipId?: string;

  @ApiPropertyOptional({
    description:
      "Indica si tiene los controles sanitarios (AIE/Glándermo) al día",
    default: true,
  })
  @IsOptional()
  @IsBoolean({
    message: "El estado de habilitación FEU debe ser un valor booleano.",
  })
  isFeuActive?: boolean;

  @ApiPropertyOptional({
    description: "Fecha de vencimiento de sanidad",
    example: "2026-12-31",
  })
  @IsOptional()
  @IsDateString(
    {},
    {
      message:
        "La fecha de vencimiento de sanidad ingresada no es válida. Use el formato YYYY-MM-DD.",
    },
  )
  healthRecordsExpiration?: string;

  @ApiPropertyOptional({
    description: "Fecha de nacimiento del caballo",
    example: "2020-05-15",
  })
  @IsOptional()
  @IsString({ message: "La fecha de nacimiento debe ser un texto válido." })
  @IsDateString(
    {},
    {
      message:
        "La fecha de nacimiento ingresada no es válida. Use el formato YYYY-MM-DD.",
    },
  )
  birthDate?: string;

  @ApiPropertyOptional({
    description: "URL de la foto oficial del caballo",
    example: "https://example.com/horse.jpg",
  })
  @IsOptional()
  @IsString({
    message: "La URL de la imagen de la foto oficial debe ser un texto válido.",
  })
  imageUrl?: string;
}
