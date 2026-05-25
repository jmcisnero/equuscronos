import { IsString, IsNotEmpty, IsOptional, IsBoolean } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateRiderDto {
  @ApiProperty({ description: 'Nombre completo del atleta (Jinete/Amazona)', example: 'Lucía Gómez' })
  @IsString({ message: 'El nombre completo debe ser un texto válido.' })
  @IsNotEmpty({ message: 'El nombre completo es obligatorio.' })
  name: string;

  @ApiProperty({ description: 'Cédula de Identidad (Requerido para validación anti-duplicados)', example: '4.234.567-8' })
  @IsString({ message: 'La cédula de identidad debe ser un texto válido.' })
  @IsNotEmpty({ message: 'La cédula de identidad es obligatoria para el control anti-duplicados.' })
  nationalId: string;

  @ApiPropertyOptional({ description: 'Carnet de la federación (FEU)', example: 'FEU-R-202' })
  @IsOptional()
  @IsString({ message: 'El carnet de la federación (FEU) debe ser un texto válido.' })
  feuId?: string;

  @ApiPropertyOptional({ description: 'Indica si tiene la ficha médica y anualidad al día', default: true })
  @IsOptional()
  @IsBoolean({ message: 'El estado de habilitación de la licencia FEU debe ser un valor booleano.' })
  isFeuActive?: boolean;

  @ApiPropertyOptional({ description: 'Fecha de nacimiento (Formato YYYY-MM-DD)', example: '1995-08-25' })
  @IsOptional()
  @IsString({ message: 'La fecha de nacimiento debe ser un texto válido en formato YYYY-MM-DD.' })
  birthDate?: string;

  @ApiPropertyOptional({ description: 'Vencimiento de ficha médica (Formato YYYY-MM-DD)', example: '2027-05-25' })
  @IsOptional()
  @IsString({ message: 'La fecha de vencimiento de ficha médica debe ser un texto válido en formato YYYY-MM-DD.' })
  medicalCardExpiration?: string;
}
