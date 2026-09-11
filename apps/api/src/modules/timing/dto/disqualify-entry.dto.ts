import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsEnum, IsInt, IsOptional, IsString } from "class-validator";
import { ParticipantStatus } from "@equuscronos/shared";

export class DisqualifyEntryDto {
  @ApiProperty({
    description: "Estado o motivo reglamentario de descalificación o retiro FEU",
    enum: ParticipantStatus,
    example: ParticipantStatus.DQ_ROUTE,
  })
  @IsEnum(ParticipantStatus)
  reason: ParticipantStatus;

  @ApiPropertyOptional({
    description: "Etapa en la que ocurre el evento de cese/descalificación",
    example: 1,
  })
  @IsOptional()
  @IsInt()
  stageNumber?: number;

  @ApiPropertyOptional({
    description: "Observaciones o nota del acta del jurado",
    example: "Desvío comprobado en tramo de control 2 por veedores",
  })
  @IsOptional()
  @IsString()
  notes?: string;
}
