import { IsInt, IsUUID, IsEnum, IsDateString, IsOptional, IsBoolean, IsString, ValidateIf } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TimeRecordType, EliminationCode } from '@equuscronos/shared';

export class CreateTimingRecordDto {
  @ApiProperty({ description: 'UUID de la Carrera activa' }) 
  @IsUUID() 
  competitionId: string;

  @ApiProperty({ description: 'UUID de la Etapa en curso' }) 
  @IsUUID() 
  stageId: string;

  @ApiPropertyOptional({ description: 'Ingreso Manual: Dorsal digitado por el Juez (Requerido si no hay chipId)', example: 102 })
  @ValidateIf(o => !o.chipId) 
  @IsInt() 
  bibNumber?: number;

  @ApiPropertyOptional({ description: 'Ingreso Automático: Lectura de Antena RFID (Requerido si no hay bibNumber)', example: 'CHIP-985121001' })
  @ValidateIf(o => !o.bibNumber) 
  @IsString() 
  chipId?: string;

  @ApiProperty({ description: 'Hito en pista (Largada, Llegada, Vet In, Vet Out)', enum: TimeRecordType, example: TimeRecordType.ARRIVAL })
  @IsEnum(TimeRecordType) 
  recordType: TimeRecordType;

  @ApiProperty({ description: 'Timestamp exacto del evento capturado por el hardware (ISO 8601 con milisegundos)', example: '2026-03-15T08:29:40.150Z' })
  @IsDateString() 
  recordedAt: string;

  @ApiPropertyOptional({ description: 'Pulsaciones por minuto (BPM). Solo aplica para VET_IN.', example: 56 }) 
  @IsOptional() 
  @IsInt() 
  heartRate?: number;

  @ApiPropertyOptional({ description: 'Dictamen de la inspección. FALSE desencadena la descalificación.', default: true }) 
  @IsOptional() 
  @IsBoolean() 
  isApproved?: boolean;

  @ApiPropertyOptional({ description: 'Código si fue descalificado', enum: EliminationCode }) 
  @IsOptional() 
  @IsEnum(EliminationCode) 
  eliminationType?: EliminationCode;

  @ApiPropertyOptional({ description: 'Justificación médica o técnica de la eliminación' }) 
  @IsOptional() 
  @IsString() 
  eliminationReason?: string;
}
