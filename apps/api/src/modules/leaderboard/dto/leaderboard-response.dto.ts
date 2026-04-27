import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ParticipantStatus } from '@equuscronos/shared';

export class LeaderboardEntryDto {
  @ApiProperty({ description: 'Posición actual en el ranking', example: 1 })
  rank: number;

  @ApiProperty({ description: 'Número de dorsal', example: 101 })
  bibNumber: number;

  @ApiProperty({ description: 'Nombre del Jinete' })
  riderName: string;

  @ApiProperty({ description: 'Nombre del Caballo' })
  horseName: string;

  @ApiProperty({ description: 'Estado actual del binomio', enum: ParticipantStatus })
  status: ParticipantStatus;

  @ApiProperty({ description: 'Etapa actual o última etapa completada', example: 2 })
  currentStage: number;

  @ApiPropertyOptional({ description: 'Hora exacta en la que cruzó la meta en la última etapa', example: '2026-03-15T08:13:19Z' })
  lastArrivalTime?: Date;

  @ApiPropertyOptional({ description: 'Hora objetivo para el control veterinario (Llegada + 20 min)' })
  nextVetControlTime?: Date;
  
  @ApiProperty({ description: 'Tiempo total neto de carrera (Milisegundos)' })
  totalRaceTimeMs: number;

  @ApiProperty({ description: 'Diferencia de tiempo con el líder (Milisegundos)' })
  gapToLeaderMs: number;

  @ApiProperty({ description: 'Velocidad promedio del competidor (km/h) con 3 decimales', example: 32.734 })
  averageSpeed: number;

  @ApiPropertyOptional({ description: 'Última frecuencia cardíaca registrada en clínica (ppm)', example: 48 })
  heartRate?: number;

  @ApiPropertyOptional({ description: 'Hora oficial calculada para largar la SIGUIENTE etapa. Solo visible durante la neutralización.', example: '2026-03-15T09:13:19Z' })
  nextStageDepartureTime?: Date;
}
