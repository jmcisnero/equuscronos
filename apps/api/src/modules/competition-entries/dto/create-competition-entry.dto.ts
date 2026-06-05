import { IsString, IsInt, IsOptional, IsBoolean, IsNumber, Min, IsArray } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateCompetitionEntryDto {
  @ApiProperty({ description: 'UUID de la Carrera a la que se inscribe' }) 
  @IsString() 
  competitionId: string;

  @ApiProperty({ description: 'UUID del Jinete' }) 
  @IsString() 
  riderId: string;

  @ApiProperty({ description: 'UUID del Caballo' }) 
  @IsString() 
  horseId: string;

  @ApiPropertyOptional({ description: 'UUID del Club que este binomio representa' }) 
  @IsOptional() 
  @IsString() 
  representedTenantId?: string;

  @ApiProperty({ description: 'Dorsal o Chaleco numérico a utilizar en pista', example: 101 }) 
  @IsInt() 
  @Min(1) 
  bibNumber: number;

  @ApiPropertyOptional({ description: 'Indica si este binomio califica para puntos', default: false }) 
  @IsOptional() 
  @IsBoolean() 
  qualifiesForPoints?: boolean;

  // ÚNICO PESO PERMITIDO EN LA INSCRIPCIÓN (El resto va por weight_controls)
  @ApiProperty({ description: 'Peso registrado (lastre o total) en kg', example: 85.00 }) 
  @IsNumber({ maxDecimalPlaces: 2 }) 
  ballastWeight: number;

  @ApiPropertyOptional({ description: 'Peso del jinete en kg', example: 70.00 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  riderWeight?: number;

  @ApiPropertyOptional({ description: 'Peso de la montura / aperos en kg', example: 15.00 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  tackWeight?: number;

  @ApiPropertyOptional({ description: 'Elementos precintados', example: ['Jergón', 'Mandil', 'Montura'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  sealedItems?: string[];

  @ApiProperty({ description: 'Número de precinto asignado para el lastre', example: 'PREC-2026-001' })
  @IsString()
  sealNumber: string;

  @ApiPropertyOptional({ description: 'Timestamp de marcación de pesaje inicial' })
  @IsOptional()
  @IsString()
  weighInAt?: Date;
}
