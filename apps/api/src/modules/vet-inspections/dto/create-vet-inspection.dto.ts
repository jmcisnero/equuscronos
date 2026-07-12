import {
  IsUUID,
  IsInt,
  IsOptional,
  IsEnum,
  IsBoolean,
  IsString,
  IsNotEmpty,
} from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { GaitStatus, InspectionType } from "@equuscronos/shared";

export class CreateVetInspectionDto {
  @ApiProperty({ description: "UUID de la competencia" })
  @IsUUID()
  competitionId: string;

  @ApiProperty({ description: "Número de etapa / Vet Gate", example: 1 })
  @IsInt()
  vetGateNumber: number;

  @ApiProperty({ description: "Número de chaleco del binomio", example: "101" })
  @IsNotEmpty()
  riderDorsal: string;

  @ApiProperty({ description: "Hora de llegada registrada en el Puesto 1" })
  @IsNotEmpty()
  arrivalTime: string;

  @ApiProperty({
    description:
      "Hora de ingreso al área veterinaria registrada en el Puesto 2",
  })
  @IsNotEmpty()
  vetInTime: string;

  @ApiProperty({
    description: "Pulsaciones por minuto registradas",
    example: 64,
  })
  @IsInt()
  heartRate: number;

  @ApiProperty({
    description: "Estado de la marcha (trote)",
    enum: GaitStatus,
  })
  @IsEnum(GaitStatus)
  gaitStatus: GaitStatus;

  @ApiProperty({
    description: "Tipo de inspección veterinaria",
    enum: InspectionType,
  })
  @IsEnum(InspectionType)
  inspectionType: InspectionType;

  @ApiProperty({
    description: "Indica si requiere rechequeo obligatorio antes de la largada",
    default: false,
  })
  @IsBoolean()
  requiresRecheck: boolean;

  @ApiPropertyOptional({
    description: "Hora límite para el rechequeo veterinario (ISO string)",
  })
  @IsOptional()
  @IsString()
  nextCheckTime?: string;

  @ApiPropertyOptional({ description: "Observaciones del Veterinario" })
  @IsOptional()
  @IsString()
  notes?: string;
}
