import useSWR from "swr";

export interface LeaderboardEntry {
  rank: number;
  bibNumber: number;
  riderName: string;
  horseName: string;
  status:
    | "IN_RACE"
    | "VET_CHECK"
    | "RESTING"
    | "FINISHED"
    | "DQ"
    | "DNF"
    | "WD";
  currentStage: number;
  lastArrivalTime?: string;
  nextVetControlTime?: string;
  totalRaceTimeMs: number;
  gapToLeaderMs: number;
  averageSpeed: number;
  heartRate?: number;
  nextStageDepartureTime?: string;
  startTime?: string;
  arrivalTime?: string;
  vetInTime?: string;
  completedStages?: number;
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

// Fetcher optimizado con manejo de excepciones y estatus HTTP
const fetcher = async (path: string) => {
  const res = await fetch(`${API_BASE_URL}${path}`);
  if (!res.ok) {
    const errorInfo = await res.json().catch(() => ({}));
    const error = new Error(
      errorInfo?.message ||
        "Ocurrió un error al consultar el servidor principal.",
    ) as any;
    error.status = res.status;
    error.info = errorInfo;
    throw error;
  }
  return res.json();
};

/**
 * Hook personalizado useLiveLeaderboard
 * Consulta y actualiza periódicamente la tabla de posiciones oficial.
 *
 * @param competitionId - UUID de la competencia a monitorear
 */
export function useLiveLeaderboard(competitionId: string) {
  const { data, error, isLoading, mutate, isValidating } = useSWR<
    LeaderboardEntry[]
  >(
    competitionId ? `/competitions/${competitionId}/leaderboard` : null,
    fetcher,
    {
      refreshInterval: 30000, // Polling de alta frecuencia: 30 segundos
      dedupingInterval: 4000, // Evita re-peticiones repetitivas en cascada rápida
      revalidateOnFocus: true, // Auto-actualización al enfocar la pestaña
    },
  );

  return {
    leaderboard: data || [],
    error,
    isLoading: isLoading,
    isValidating,
    mutate,
  };
}
