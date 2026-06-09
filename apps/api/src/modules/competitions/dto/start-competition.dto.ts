import { IsDateString, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class StartCompetitionDto {
  @ApiPropertyOptional({ description: 'Hora de largada oficial pre-configurada (ISO 8601)', example: '2026-03-15T07:15:00.000Z' })
  @IsOptional()
  @IsDateString()
  officialStartTime?: string;
}
