import { IsUUID, IsInt, IsOptional, IsEnum, IsNumber, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ClinicalStatus, MotricityStatus } from '@equuscronos/shared';

export class CreateVetInspectionDto {
  @ApiProperty({ description: 'UUID del registro de tiempo (VET_IN) asociado' })
  @IsUUID()
  timingRecordId: string;

  @ApiProperty({ description: 'Pulsaciones por minuto registradas', example: 64 })
  @IsInt()
  heartRate: number;

  @ApiPropertyOptional({ description: 'Temperatura corporal', example: 38.5 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 1 })
  temperature?: number;

  @ApiProperty({ description: 'Estado en la prueba de trote', enum: MotricityStatus })
  @IsEnum(MotricityStatus)
  motricity: MotricityStatus;

  @ApiProperty({ description: 'Estado metabólico general', enum: ClinicalStatus })
  @IsEnum(ClinicalStatus)
  metabolic: ClinicalStatus;

  @ApiPropertyOptional({ description: 'Observaciones del Médico Veterinario' })
  @IsOptional()
  @IsString()
  notes?: string;
}
