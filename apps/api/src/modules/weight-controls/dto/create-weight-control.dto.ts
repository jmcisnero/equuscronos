import {
  IsUUID,
  IsNumber,
  IsString,
  IsNotEmpty,
  IsOptional,
  Min,
  IsIn,
} from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class CreateWeightControlDto {
  @ApiProperty({ description: "UUID de la inscripción del binomio" })
  @IsUUID()
  entryId: string;

  @ApiPropertyOptional({
    description: "UUID de la etapa (Nulo si es el pesaje inicial del sábado)",
  })
  @IsOptional()
  @IsUUID()
  stageId?: string;

  @ApiProperty({
    description: "Peso marcado por la balanza oficial",
    example: 85.5,
  })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  weightRecorded: number;

  @ApiProperty({
    description: "Momento del pesaje (INITIAL, NEUTRALIZATION, ARRIVAL)",
    example: "INITIAL",
  })
  @IsString()
  @IsNotEmpty()
  @IsIn(["INITIAL", "NEUTRALIZATION", "ARRIVAL"], {
    message: "El tipo de control debe ser INITIAL, NEUTRALIZATION o ARRIVAL",
  })
  controlType: string;

  @ApiPropertyOptional({
    description: "UUID del Juez de Balanza (Opcional por ahora)",
  })
  @IsOptional()
  @IsUUID()
  recordedById?: string;
}
