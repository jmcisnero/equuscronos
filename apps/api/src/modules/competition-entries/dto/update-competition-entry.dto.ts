import { PartialType } from '@nestjs/mapped-types';
import { CreateCompetitionEntryDto } from './create-competition-entry.dto';
import { IsEnum, IsOptional, IsUUID, IsNumber } from 'class-validator';
import { ParticipantStatus } from '@equuscronos/shared';

export class UpdateCompetitionEntryDto extends PartialType(CreateCompetitionEntryDto) {
  @IsOptional()
  @IsEnum(ParticipantStatus)
  status?: ParticipantStatus;

  @IsOptional()
  @IsUUID()
  currentStageId?: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  checkOutWeight?: number; // Peso de auditoría al finalizar
}
