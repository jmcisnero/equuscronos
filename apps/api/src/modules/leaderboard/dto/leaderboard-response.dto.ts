import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { ParticipantStatus } from "@equuscronos/shared";

export class LeaderboardEntryDto {
  @ApiProperty({
    description: "ID de la inscripción del competidor",
    example: "a0b1c2d3-e4f5-6789-0123-456789abcdef",
  })
  entryId: string;

  @ApiPropertyOptional({
    description: "Posición actual en el ranking",
    example: 1,
  })
  rank: number | null;

  @ApiProperty({ description: "Número de dorsal", example: 101 })
  bibNumber: number;

  @ApiProperty({ description: "Nombre del Jinete" })
  riderName: string;

  @ApiProperty({ description: "Nombre del Caballo" })
  horseName: string;

  @ApiProperty({
    description: "Estado actual del binomio",
    enum: ParticipantStatus,
  })
  status: ParticipantStatus;

  @ApiProperty({
    description: "Etapa actual o última etapa completada",
    example: 2,
  })
  currentStage: number;

  @ApiPropertyOptional({
    description: "Hora exacta en la que cruzó la meta en la última etapa",
    example: "2026-03-15T08:13:19Z",
  })
  lastArrivalTime?: Date;

  @ApiPropertyOptional({
    description: "Hora objetivo para el control veterinario (Llegada + 20 min)",
  })
  nextVetControlTime?: Date;

  @ApiPropertyOptional({
    description:
      "Tiempo total neto de carrera (Milisegundos) o null si está en etapa activa",
  })
  totalRaceTimeMs: number | null;

  @ApiPropertyOptional({
    description:
      "Diferencia de tiempo con el líder (Milisegundos) o null si está en etapa activa",
  })
  gapToLeaderMs: number | null;

  @ApiPropertyOptional({
    description:
      "Velocidad promedio del competidor (km/h) con 3 decimales o null si está en etapa activa",
    example: 32.734,
  })
  averageSpeed: number | null;

  @ApiPropertyOptional({
    description: "Última frecuencia cardíaca registrada en clínica (ppm)",
    example: 48,
  })
  heartRate?: number;

  @ApiPropertyOptional({
    description:
      "Hora oficial calculada para largar la SIGUIENTE etapa. Solo visible durante la neutralización.",
    example: "2026-03-15T09:13:19Z",
  })
  nextStageDepartureTime?: Date;

  @ApiPropertyOptional({
    description: "Hora de largada/salida de la etapa actual o más reciente",
    example: "2026-03-15T08:00:00Z",
  })
  startTime?: Date;

  @ApiPropertyOptional({
    description: "Hora de arribo/llegada de la etapa actual o más reciente",
    example: "2026-03-15T09:30:00Z",
  })
  arrivalTime?: Date;

  @ApiPropertyOptional({
    description: "Hora de presentación en el control veterinario (VET_IN)",
    example: "2026-03-15T09:45:00Z",
  })
  vetInTime?: Date;

  @ApiPropertyOptional({
    description: "Cantidad de etapas completadas con éxito",
    example: 1,
  })
  completedStages?: number;

  @ApiPropertyOptional({
    description: "Club/Tenant representado por el competidor",
  })
  representedTenant?: {
    id: string;
    name: string;
    location?: string;
    jerseyImageUrl?: string;
  };

  @ApiPropertyOptional({
    description: "Penalizaciones acumuladas por el competidor",
    type: "array",
  })
  penalties?: any[];

  @ApiPropertyOptional({
    description: "Detalle de las etapas recorridas por el competidor",
    type: "array",
  })
  stages?: any[];
}
