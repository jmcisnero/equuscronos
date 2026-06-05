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

      // Extraemos la hora de próxima largada calculada previamente.
      // Solo la enviamos si existe y si el caballo no ha largado la etapa siguiente aún.
      let nextStageDepartureTime = null;
      if (lastArrival && lastArrival.scheduledDepartureTime) {
        // Verificamos si ya hay un START posterior a esta llegada
        const hasStartedNextStage = entry.timingRecords.some(r => 
          r.recordType === TimeRecordType.START && 
          new Date(r.recordedAt).getTime() > new Date(lastArrival.recordedAt).getTime()
        );    
        if (!hasStartedNextStage) {
          nextStageDepartureTime = new Date(lastArrival.scheduledDepartureTime);
        }
      }
      
      // Extraemos la hora de largada, llegada e ingreso a vet gate de la etapa actual o más reciente
      let startTime = null;
      let arrivalTime = null;
      let vetInTime = null;
      const activeRecords = (entry.timingRecords || []).filter(r => !r.isVoid);
      if (activeRecords.length > 0) {
        const stageNums = activeRecords.map(r => r.stage?.stageNumber || 1);
        const maxStageNum = Math.max(...stageNums);
        const latestStageRecords = activeRecords.filter(r => (r.stage?.stageNumber || 1) === maxStageNum);
        
        const startRecord = latestStageRecords
          .filter(r => r.recordType === TimeRecordType.START)
          .sort((a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime())[0];
        if (startRecord) {
          startTime = new Date(startRecord.recordedAt);
        }

        const arrivalRecord = latestStageRecords
          .filter(r => r.recordType === TimeRecordType.ARRIVAL)
          .sort((a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime())[0];
        if (arrivalRecord) {
          arrivalTime = new Date(arrivalRecord.recordedAt);
        }

        const vetInRecord = latestStageRecords
          .filter(r => r.recordType === TimeRecordType.VET_IN)
          .sort((a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime())[0];
        if (vetInRecord) {
          vetInTime = new Date(vetInRecord.recordedAt);
        }
      }

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
        nextStageDepartureTime: nextStageDepartureTime,
        startTime: startTime,
        arrivalTime: arrivalTime,
        vetInTime: vetInTime,
        completedStages: stats.completedStages,
      };
    });

    // 3. Algoritmo de Ranking FEU (Ordena primero por estado activo, luego por cantidad de etapas completadas de forma descendente, y luego por menor tiempo neto acumulado)
    const activeStatuses = [ParticipantStatus.IN_RACE, ParticipantStatus.RESTING, ParticipantStatus.FINISHED, ParticipantStatus.VET_CHECK];
    
    leaderboard.sort((a, b) => {
      const aIsActive = activeStatuses.includes(a.status);
      const bIsActive = activeStatuses.includes(b.status);

      if (aIsActive && !bIsActive) return -1;
      if (!aIsActive && bIsActive) return 1;
      
      const aCompleted = a.completedStages || 0;
      const bCompleted = b.completedStages || 0;
      if (aCompleted !== bCompleted) {
        return bCompleted - aCompleted; // El que tenga más etapas completadas va primero
      }
      
      return a.totalRaceTimeMs - b.totalRaceTimeMs; // A igualdad de etapas, menor tiempo neto va primero
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
  private calculateCompetitorStats(records: any[]): { totalTimeMs: number, averageSpeed: number, completedStages: number } {
    if (!records || records.length === 0) return { totalTimeMs: 0, averageSpeed: 0, completedStages: 0 };
    
    let totalMs = 0;
    let completedDistanceKm = 0;
    let completedStages = 0;

    // Agrupar por etapa para emparejar START con ARRIVAL, ignorando registros anulados (isVoid)
    const activeRecords = (records || []).filter(r => !r.isVoid);
    const recordsByStage = activeRecords.reduce((acc, curr) => {
      if (!curr.stage) return acc;
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
        completedStages++;
      }
    }

    // Fórmula: (Distancia en Km / Tiempo en Horas) = Km/h
    let averageSpeed = 0;
    if (totalMs > 0 && completedDistanceKm > 0) {
      const totalHours = totalMs / 3600000;
      averageSpeed = parseFloat((completedDistanceKm / totalHours).toFixed(3)); // 3 decimales FEU
    }

    return { totalTimeMs: totalMs, averageSpeed, completedStages };
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

  /**
   * Calcula la hora límite de presentación en el Vet-Gate (Art. FEU).
   * Por defecto, el reglamento suele exigir 20 minutos tras la llegada.
   */
  private calculateTargetVetTime(records: any[]): Date | null {
    if (!records || records.length === 0) return null;
    
    const lastArrival = records
      .filter(r => r.recordType === TimeRecordType.ARRIVAL)
      .sort((a, b) => new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime())[0];
      
    if (!lastArrival) return null;
    
    // Tiempo reglamentario: 20 minutos (esto idealmente viene de la Stage, pero asumimos 20)
    const targetVetTime = new Date(lastArrival.recordedAt);
    targetVetTime.setMinutes(targetVetTime.getMinutes() + 20);
    
    return targetVetTime;
  }
}
