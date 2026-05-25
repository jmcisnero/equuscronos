import { IsString, IsNotEmpty, IsOptional, IsBoolean, IsUUID, IsDateString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateHorseDto {
  @ApiProperty({ description: 'Nombre oficial deportivo del caballo', example: 'Tormenta Criolla' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ description: 'UUID del propietario legal del caballo', example: 'b1000000-0000-0000-0000-000000000001' })
  @IsString()
  @IsNotEmpty()
  // El propietario es obligatorio para garantizar la trazabilidad de los binomios y la confección de planillas oficiales de la FEU
  ownerId: string;

  @ApiPropertyOptional({ description: 'Número de pasaporte o carnet federativo (FEU)', example: 'FEU-H-101' })
  @IsOptional()
  @IsString()
  feuId?: string;

  @ApiPropertyOptional({ description: 'Código del microchip RFID para lectura automática', example: 'CHIP-985121000' })
  @IsOptional()
  @IsString()
  chipId?: string;

  @ApiPropertyOptional({ description: 'Indica si tiene los controles sanitarios (AIE/Glándermo) al día', default: true })
  @IsOptional()
  @IsBoolean()
  isFeuActive?: boolean;

  @ApiPropertyOptional({ description: 'Fecha de vencimiento de sanidad', example: '2026-12-31' })
  @IsOptional()
  @IsDateString()
  healthRecordsExpiration?: string;
}
