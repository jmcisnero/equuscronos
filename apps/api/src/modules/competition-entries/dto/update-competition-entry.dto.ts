import { PartialType, ApiPropertyOptional } from '@nestjs/swagger';
import { CreateCompetitionEntryDto } from './create-competition-entry.dto';
import { IsEnum, IsOptional, IsUUID, IsNumber } from 'class-validator';
import { ParticipantStatus } from '@equuscronos/shared';

export class UpdateCompetitionEntryDto extends PartialType(CreateCompetitionEntryDto) {
  @ApiPropertyOptional({ description: 'Estado en vivo en la pista', enum: ParticipantStatus }) 
  @IsOptional() 
  @IsEnum(ParticipantStatus) 
  status?: ParticipantStatus;

  @ApiPropertyOptional({ description: 'Fase en la que se encuentra corriendo actualmente' }) 
  @IsOptional() 
  @IsUUID() 
  currentStageId?: string;

  @ApiPropertyOptional({ description: 'Peso registrado en balanza de auditoría al cruzar la meta (Anti-fraude)', example: 75.8 }) 
  @IsOptional() 
  @IsNumber({ maxDecimalPlaces: 2 }) 
  checkOutWeight?: number;
}
