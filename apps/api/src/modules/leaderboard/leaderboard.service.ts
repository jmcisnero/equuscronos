import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CompetitionEntry } from '../competition-entries/entities/competition-entry.entity';
import { LeaderboardEntryDto } from './dto/leaderboard-response.dto';
import { TimeRecordType, ParticipantStatus } from '@equuscronos/shared';

@Injectable()
export class LeaderboardService {
  constructor(
    @InjectRepository(CompetitionEntry)
    private readonly entryRepository: Repository<CompetitionEntry>,
  ) {}

  async getLiveLeaderboard(competitionId: string): Promise<LeaderboardEntryDto[]> {
    // 1. Extracción Profunda Optimizada (Traemos Tiempos y Clínica de una sola vez)
    const entries = await this.entryRepository.createQueryBuilder('entry')
      .innerJoinAndSelect('entry.rider', 'rider')
      .innerJoinAndSelect('entry.horse', 'horse')
      .leftJoinAndSelect('entry.currentStage', 'currentStage')
      .leftJoinAndSelect('entry.timingRecords', 'timing')
      .leftJoinAndSelect('timing.stage', 'stage')
      .leftJoinAndSelect('timing.vetInspection', 'vet') // <-- EXTRAEMOS EL PULSO CLÍNICO
      .where('entry.competition_id = :competitionId', { competitionId })
      .getMany();

    // 2. Procesamiento Matemático por Competidor
    const leaderboard: LeaderboardEntryDto[] = entries.map(entry => {
      const stats = this.calculateCompetitorStats(entry.timingRecords);
      const latestHeartRate = this.extractLatestHeartRate(entry.timingRecords);

      // Extraemos la última hora de llegada registrada
      const lastArrival = entry.timingRecords
        .filter(r => r.recordType === TimeRecordType.ARRIVAL)
        .sort((a, b) => new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime())[0];
    
      const lastArrivalTime = lastArrival ? new Date(lastArrival.recordedAt) : null;
      const nextVetControlTime = this.calculateTargetVetTime(entry.timingRecords);
      
      return {
        bibNumber: entry.bibNumber,
        riderName: entry.rider.name,
        horseName: entry.horse.name,
        status: entry.status,
        currentStage: entry.currentStage?.stageNumber || 1,
        lastArrivalTime: lastArrivalTime, 
        nextVetControlTime: nextVetControlTime,
        totalRaceTimeMs: stats.totalTimeMs,
        averageSpeed: stats.averageSpeed,
        heartRate: latestHeartRate,
        rank: 0,
        gapToLeaderMs: 0,
      };
    });

    // 3. Algoritmo de Ranking FEU
    const activeStatuses = [ParticipantStatus.IN_RACE, ParticipantStatus.RESTING, ParticipantStatus.FINISHED, ParticipantStatus.VET_CHECK];
    
    leaderboard.sort((a, b) => {
      const aIsActive = activeStatuses.includes(a.status);
      const bIsActive = activeStatuses.includes(b.status);

      if (aIsActive && !bIsActive) return -1;
      if (!aIsActive && bIsActive) return 1;
      if (a.currentStage !== b.currentStage) return b.currentStage - a.currentStage;
      return a.totalRaceTimeMs - b.totalRaceTimeMs;
    });

    // 4. Asignación de Gaps (Diferencias de tiempo)
    const leaderTime = leaderboard[0]?.totalRaceTimeMs || 0;
    leaderboard.forEach((entry, index) => {
      entry.rank = index + 1;
      entry.gapToLeaderMs = entry.totalRaceTimeMs > 0 ? entry.totalRaceTimeMs - leaderTime : 0;
    });

    return leaderboard;
  }

  /**
   * Calcula el Tiempo Neto y la Velocidad Promedio de este competidor.
   */
  private calculateCompetitorStats(records: any[]): { totalTimeMs: number, averageSpeed: number } {
    if (!records || records.length === 0) return { totalTimeMs: 0, averageSpeed: 0 };
    
    let totalMs = 0;
    let completedDistanceKm = 0;

    // Agrupar por etapa para emparejar START con ARRIVAL
    const recordsByStage = records.reduce((acc, curr) => {
      const stageId = curr.stage.id;
      if (!acc[stageId]) acc[stageId] = { distance: Number(curr.stage.distanceKm) };
      acc[stageId][curr.recordType] = curr.recordedAt;
      return acc;
    }, {});

    for (const stageId in recordsByStage) {
      const stage = recordsByStage[stageId];
      if (stage[TimeRecordType.START] && stage[TimeRecordType.ARRIVAL]) {
        const start = new Date(stage[TimeRecordType.START]).getTime();
        const arrival = new Date(stage[TimeRecordType.ARRIVAL]).getTime();
        
        totalMs += (arrival - start);
        completedDistanceKm += stage.distance; // Solo sumamos distancia de etapas terminadas
      }
    }

    // Fórmula: (Distancia en Km / Tiempo en Horas) = Km/h
    let averageSpeed = 0;
    if (totalMs > 0 && completedDistanceKm > 0) {
      const totalHours = totalMs / 3600000;
      averageSpeed = parseFloat((completedDistanceKm / totalHours).toFixed(3)); // 3 decimales FEU
    }

    return { totalTimeMs: totalMs, averageSpeed };
  }

  /**
   * Busca el último registro VET_IN válido y extrae el pulso de la clínica.
   */
  private extractLatestHeartRate(records: any[]): number | null {
    if (!records) return null;
    
    // Ordenar de más reciente a más antiguo
    const sortedRecords = [...records].sort((a, b) => new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime());
    
    // Buscar el VET_IN más reciente que tenga una inspección veterinaria asociada
    const latestVetRecord = sortedRecords.find(r => r.recordType === TimeRecordType.VET_IN && r.vetInspection != null);
    
    return latestVetRecord ? latestVetRecord.vetInspection.heartRate : null;
  }
}
