// create-competition.dto.ts
import { IsString, IsUUID, IsDateString, IsBoolean, IsEnum, ValidateNested, ArrayMinSize, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';
import { CompStatus } from '@equuscronos/shared';
import { CreateStageDto } from './create-stage.dto';

export class CreateCompetitionDto {
  @IsUUID()
  tenantId: string;

  @IsUUID()
  competitionTypeId: string;

  @IsString()
  name: string;

  @IsDateString()
  competitionDate: string; // Formato YYYY-MM-DD

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsBoolean()
  isFederated?: boolean;

  @IsOptional()
  @IsEnum(CompStatus)
  status?: CompStatus;

  // NestJS valida que el array contenga objetos CreateStageDto válidos
  @ValidateNested({ each: true })
  @Type(() => CreateStageDto)
  @ArrayMinSize(1, { message: 'La competencia debe tener al menos 1 etapa.' })
  stages: CreateStageDto[];
}
