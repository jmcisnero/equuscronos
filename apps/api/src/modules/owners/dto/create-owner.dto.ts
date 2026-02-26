import { IsString, IsNotEmpty, IsOptional, IsEnum } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { OwnerType } from '@equuscronos/shared';

export class CreateOwnerDto {
  @ApiProperty({ description: 'Nombre completo de la persona, o nombre del Stud/Haras', example: 'Haras El Relincho' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ description: 'Categoría del propietario', enum: OwnerType, example: OwnerType.HARAS })
  @IsEnum(OwnerType)
  type: OwnerType;

  @ApiPropertyOptional({ description: 'Teléfono o email de contacto', example: 'contacto@elrelincho.uy' })
  @IsOptional()
  @IsString()
  contactInfo?: string;
}
