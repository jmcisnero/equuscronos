import { IsUUID, IsInt, IsOptional, IsBoolean, IsNumber, Min } from 'class-validator';

export class CreateCompetitionEntryDto {
  @IsUUID()
  competitionId: string;

  @IsUUID()
  riderId: string;

  @IsUUID()
  horseId: string;

  @IsOptional()
  @IsUUID()
  representedTenantId?: string; // Club al que representa

  @IsInt()
  @Min(1)
  bibNumber: number; // El Dorsal

  @IsOptional()
  @IsBoolean()
  qualifiesForPoints?: boolean;

  // --- Pesajes (Pueden llenarse después en el Update) ---
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  initialRiderWeight?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  initialEquipmentWeight?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  checkInWeight?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  ballastWeight?: number;
}
