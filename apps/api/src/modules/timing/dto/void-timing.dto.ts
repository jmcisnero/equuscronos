import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class VoidTimingRecordDto {
  @ApiProperty({ description: 'Razón técnica de la anulación', example: 'Error de tipeo de dorsal' })
  @IsNotEmpty({ message: 'La razón de la anulación es requerida' })
  @IsString()
  voidReason: string;
}
