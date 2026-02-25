// create-stage.dto.ts
import { IsInt, IsNumber, Min, IsOptional } from 'class-validator';

export class CreateStageDto {
  @IsInt()
  @Min(1)
  stageNumber: number;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.1)
  distanceKm: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  neutralizationMinutes?: number;
}
