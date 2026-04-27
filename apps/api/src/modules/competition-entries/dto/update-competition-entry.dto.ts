import { PartialType, ApiPropertyOptional } from '@nestjs/swagger';
import { CreateCompetitionEntryDto } from './create-competition-entry.dto';
import { IsEnum, IsOptional, IsInt, IsUUID, IsNumber } from 'class-validator';
import { ParticipantStatus } from '@equuscronos/shared';

export class UpdateCompetitionEntryDto extends PartialType(CreateCompetitionEntryDto) {
  @ApiPropertyOptional({ description: 'Estado actual del participante', enum: ParticipantStatus })
  @IsOptional()
  @IsEnum(ParticipantStatus)
  status?: ParticipantStatus;

  @ApiPropertyOptional({ description: 'Posición final oficial', example: 1 })
  @IsOptional()
  @IsInt()
  finalPosition?: number;

  @ApiPropertyOptional({ description: 'ID de la etapa actual donde se encuentra el binomio' })
  @IsOptional()
  @IsUUID()
  currentStageId?: string;

  @ApiPropertyOptional({ description: 'Corrección del peso de lastre (kg)', example: 8.00 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  ballastWeight?: number;
}
