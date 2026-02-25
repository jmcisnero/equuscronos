import { IsInt, IsUUID, IsEnum, IsDateString, IsOptional, IsBoolean, IsString, ValidateIf } from 'class-validator';
import { TimeRecordType, EliminationCode } from '@equuscronos/shared';

export class CreateTimingRecordDto {
  @IsUUID()
  competitionId: string;

  @IsUUID()
  stageId: string;

  // Validación Condicional: Debe venir el Dorsal O el Chip RFID
  @ValidateIf(o => !o.chipId)
  @IsInt()
  bibNumber?: number;

  @ValidateIf(o => !o.bibNumber)
  @IsString()
  chipId?: string;

  @IsEnum(TimeRecordType)
  recordType: TimeRecordType;

  // CRÍTICO: Hora exacta capturada por el hardware o dispositivo móvil.
  // Formato ISO 8601 (Ej: 2026-03-15T08:30:15.450Z - Incluye milisegundos)
  @IsDateString()
  recordedAt: string;

  // --- Opcionales (Flujo Veterinario o Control Manual) ---
  @IsOptional()
  @IsInt()
  heartRate?: number;

  @IsOptional()
  @IsBoolean()
  isApproved?: boolean;

  @IsOptional()
  @IsEnum(EliminationCode)
  eliminationType?: EliminationCode;

  @IsOptional()
  @IsString()
  eliminationReason?: string;
}
