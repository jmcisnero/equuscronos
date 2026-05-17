import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { Stage } from '../../competitions/entities/stage.entity';

@Injectable()
export class TimeCalculationService {
  /**
   * Calcula la hora oficial de largada para la siguiente etapa
   * según el Reglamento FEU (Art. 54).
   * @param arrivalTime - El timestamp exacto en el que el caballo cruzó la meta.
   * @param currentStage - La etapa actual que contiene los minutos de neutralización.
   * @returns Date - El timestamp exacto en el que el caballo debe largar la siguiente etapa.
   */
  calculateNextDepartureTime(arrivalTime: Date, currentStage: Stage): Date {
    if (!arrivalTime || isNaN(arrivalTime.getTime())) {
      throw new InternalServerErrorException('Timestamp de llegada inválido para el cálculo.');
    }

    // Regla de Negocio FEU (Art. 28): La neutralización es obligatoria. 
    // Usamos el configurado en la etapa, o aplicamos 60 minutos como fallback estricto reglamentario.
    const neutralization = currentStage.neutralizationMinutes !== undefined && currentStage.neutralizationMinutes !== null
      ? currentStage.neutralizationMinutes
      : 60; // Fallback hardcoded para asegurar cumplimiento de la FEU

    // Si la neutralización explícita es 0 (ej. última etapa), no hay próxima salida
    if (neutralization === 0) {
      return null;
    }

    // Clonamos la fecha para no mutar el objeto original
    const scheduledDeparture = new Date(arrivalTime.getTime());
    
    // Sumamos los minutos reglamentarios garantizando la neutralización obligatoria
    scheduledDeparture.setMinutes(scheduledDeparture.getMinutes() + neutralization);

    return scheduledDeparture;
  }

  /**
   * Calcula el tiempo total de carrera en milisegundos y lo formatea (Opcional para Leaderboard)
   */
  calculateTotalRaceTime(startTime: Date, arrivalTime: Date): number {
    return arrivalTime.getTime() - startTime.getTime();
  }
}
