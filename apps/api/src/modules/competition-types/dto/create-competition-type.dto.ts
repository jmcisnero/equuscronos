import { IsString, IsNotEmpty, IsOptional, IsObject } from 'class-validator';

export class CreateCompetitionTypeDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsOptional()
  @IsObject()
  defaultRules?: Record<string, any>;
}
