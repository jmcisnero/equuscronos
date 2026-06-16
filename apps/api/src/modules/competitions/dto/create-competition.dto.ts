import {
  IsString,
  IsUUID,
  IsDateString,
  IsBoolean,
  IsEnum,
  ValidateNested,
  ArrayMinSize,
  IsOptional,
  IsInt,
  Min,
  Max,
  Matches,
} from "class-validator";
import { Type } from "class-transformer";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { CompetitionStatus } from "@equuscronos/shared";
import { CreateStageDto } from "./create-stage.dto";

export class CreateCompetitionDto {
  @ApiProperty({ description: "UUID del Club anfitrión" })
  @IsString()
  tenantId: string;

  @ApiProperty({ description: "UUID de la modalidad/regla a aplicar" })
  @IsString()
  competitionTypeId: string;

  @ApiProperty({
    description: "Nombre oficial del evento",
    example: "Raid Batalla de Tupambaé",
  })
  @IsString()
  name: string;

  @ApiProperty({
    description: "Fecha programada de largada (YYYY-MM-DD)",
    example: "2026-03-15",
  })
  @IsDateString()
  competitionDate: string;

  @ApiProperty({
    description: "Hora programada de largada (HH:mm:ss o HH:mm)",
    example: "07:00:00",
  })
  @IsString()
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$/, {
    message:
      "La hora de largada debe tener un formato de hora válido (HH:mm o HH:mm:ss)",
  })
  startTime: string;

  @ApiPropertyOptional({
    description: "Ubicación física o predio de largada",
    example: "Ruta 8, Melo, Cerro Largo",
  })
  @IsOptional()
  @IsString()
  location?: string;

  @ApiPropertyOptional({
    description: "Determina si el resultado va al ranking nacional",
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  isFederated?: boolean;

  @ApiPropertyOptional({
    description: "Límite máximo de pulsaciones permitido",
    default: 65,
    minimum: 40,
    maximum: 80,
  })
  @IsOptional()
  @IsInt({ message: "El límite debe ser un número entero" })
  @Min(40, { message: "El límite no puede ser menor a 40 ppm" })
  @Max(80, { message: "El límite no puede ser mayor a 80 ppm" })
  maxHeartRate?: number;

  @ApiPropertyOptional({
    description: "Estado operativo del evento",
    enum: CompetitionStatus,
    default: CompetitionStatus.PLANNED,
  })
  @IsOptional()
  @IsEnum(CompetitionStatus)
  status?: CompetitionStatus;

  @ApiProperty({
    description: "Matriz anidada con la definición de cada etapa de la carrera",
    type: [CreateStageDto],
  })
  @ValidateNested({ each: true })
  @Type(() => CreateStageDto)
  @ArrayMinSize(1, { message: "La competencia debe tener al menos 1 etapa." })
  stages: CreateStageDto[];
}
