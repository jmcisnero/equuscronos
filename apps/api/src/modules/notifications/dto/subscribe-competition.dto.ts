import { IsString, IsNotEmpty, IsOptional, IsBoolean } from "class-validator";

export class SubscribeCompetitionDto {
  @IsString()
  @IsNotEmpty()
  deviceToken: string;

  @IsString()
  @IsNotEmpty()
  competitionId: string;

  @IsBoolean()
  @IsOptional()
  notifyStatusChange?: boolean;

  @IsBoolean()
  @IsOptional()
  notifyStageStart?: boolean;

  @IsBoolean()
  @IsOptional()
  notifyVetGate?: boolean;

  @IsBoolean()
  @IsOptional()
  notifyOfficialResults?: boolean;
}
