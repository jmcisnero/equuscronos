import { IsString, IsNotEmpty, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateTenantDto {
  @ApiProperty({ description: 'Nombre de la institución (Ej: Sociedad Hípica de Melo)', example: 'Sociedad Hípica de Melo' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({ description: 'Ubicación física, ciudad y departamento', example: 'Melo, Cerro Largo' })
  @IsOptional()
  @IsString()
  location?: string;
}
