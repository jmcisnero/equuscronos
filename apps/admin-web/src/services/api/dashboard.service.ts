import { Horse } from '@/types/horse';
import { Competition } from '@/types/competition';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/admin';

export interface DashboardStats {
  totalHorses: number;
  totalRiders: number;
  totalOwners: number;
  activeHorses: number;
  activeRiders: number;
  expiredHealthHorses: number;
  expiringHorses: Horse[];
  activeCompetition: Competition | null;
  upcomingCompetitions: Competition[];
}

export const DashboardService = {
  async getStats(): Promise<DashboardStats> {
    const response = await fetch(`${API_URL}/dashboard/stats`);
    if (!response.ok) {
      throw new Error('Error al obtener estadísticas del dashboard central.');
    }
    return response.json();
  }
};
