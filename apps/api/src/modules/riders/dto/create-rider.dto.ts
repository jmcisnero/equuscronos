import { IsString, IsNotEmpty, IsOptional, IsBoolean } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateRiderDto {
  @ApiProperty({ description: 'Nombre completo del atleta (Jinete/Amazona)', example: 'Lucía Gómez' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ description: 'Cédula de Identidad (Requerido para validación anti-duplicados)', example: '4.234.567-8' })
  @IsString()
  @IsNotEmpty()
  nationalId: string;

  @ApiPropertyOptional({ description: 'Carnet de la federación (FEU)', example: 'FEU-R-202' })
  @IsOptional()
  @IsString()
  feuId?: string;

  @ApiPropertyOptional({ description: 'Indica si tiene la ficha médica y anualidad al día', default: true })
  @IsOptional()
  @IsBoolean()
  isFeuActive?: boolean;
}
