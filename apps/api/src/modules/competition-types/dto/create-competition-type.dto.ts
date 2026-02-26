import { IsString, IsNotEmpty, IsOptional, IsObject } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateCompetitionTypeDto {
  @ApiProperty({ description: 'Nombre de la plantilla de reglas', example: 'Enduro FEI 120km' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({ description: 'JSON con parámetros reglamentarios (BPM máx, peso mínimo)', example: { max_heart_rate: 64, min_weight_kg: 75 } })
  @IsOptional()
  @IsObject()
  defaultRules?: Record<string, any>;
}
