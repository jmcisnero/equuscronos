import { IsInt, IsNumber, Min, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateStageDto {
  @ApiProperty({ description: 'Orden cronológico de la fase (1, 2, 3...)', example: 1 })
  @IsInt()
  @Min(1)
  stageNumber: number;

  @ApiProperty({ description: 'Distancia a recorrer en esta etapa (Km)', example: 40.0 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.1)
  distanceKm: number;

  @ApiPropertyOptional({ description: 'Minutos de descanso obligatorio en el Vet Gate al terminar esta etapa', example: 40 })
  @IsOptional()
  @IsInt()
  @Min(0)
  neutralizationMinutes?: number;
}
