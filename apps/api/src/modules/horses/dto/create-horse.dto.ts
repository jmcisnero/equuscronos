import { IsString, IsNotEmpty, IsOptional, IsBoolean, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateHorseDto {
  @ApiProperty({ description: 'Nombre oficial deportivo del caballo', example: 'Tormenta Criolla' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({ description: 'UUID del propietario legal' })
  @IsOptional()
  @IsUUID()
  ownerId?: string;

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
}
