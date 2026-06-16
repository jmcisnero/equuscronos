import { IsNotEmpty, IsDateString } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class UpdateTimingRecordDto {
  @ApiProperty({
    description: "Nuevo timestamp del evento (ISO 8601)",
    example: "2026-03-15T08:29:40.150Z",
  })
  @IsNotEmpty({ message: "La fecha grabada es requerida" })
  @IsDateString()
  recordedAt: string;
}
