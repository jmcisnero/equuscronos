import { IsUUID, IsInt, IsOptional, IsBoolean, IsNumber, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateCompetitionEntryDto {
  @ApiProperty({ description: 'UUID de la Carrera a la que se inscribe' }) 
  @IsUUID() 
  competitionId: string;
  
  @ApiProperty({ description: 'UUID del Jinete' }) 
  @IsUUID() 
  riderId: string;
  
  @ApiProperty({ description: 'UUID del Caballo' }) 
  @IsUUID() 
  horseId: string;

  @ApiPropertyOptional({ description: 'UUID del Club que este binomio representa (para tabla por equipos)' }) 
  @IsOptional() 
  @IsUUID() 
  representedTenantId?: string;

  @ApiProperty({ description: 'Dorsal o Chaleco numérico a utilizar en pista', example: 101 }) 
  @IsInt() 
  @Min(1) 
  bibNumber: number;

  @ApiPropertyOptional({ description: 'Indica si este binomio califica para puntos en el campeonato', default: false }) 
  @IsOptional() 
  @IsBoolean() 
  qualifiesForPoints?: boolean;

  @ApiPropertyOptional({ description: 'Peso base del jinete (Kg)', example: 68.0 }) 
  @IsOptional() 
  @IsNumber({ maxDecimalPlaces: 2 }) 
  initialRiderWeight?: number;

  @ApiPropertyOptional({ description: 'Peso de la montura/recado (Kg)', example: 8.5 }) 
  @IsOptional() 
  @IsNumber({ maxDecimalPlaces: 2 }) 
  initialEquipmentWeight?: number;

  @ApiPropertyOptional({ description: 'Peso total en balanza oficial (Jinete + Equipo)', example: 76.5 }) 
  @IsOptional() 
  @IsNumber({ maxDecimalPlaces: 2 }) 
  checkInWeight?: number;

  @ApiPropertyOptional({ description: 'Peso muerto (Lastre en plomo) asignado para alcanzar el mínimo reglamentario', example: 7.0 }) 
  @IsOptional() 
  @IsNumber({ maxDecimalPlaces: 2 }) 
  ballastWeight?: number;
}
