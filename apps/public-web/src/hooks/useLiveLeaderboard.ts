import { useState, useEffect } from "react";
import useSWR from "swr";
import io from "socket.io-client";

export interface LeaderboardEntry {
  rank: number | null;
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
  | "WD"
  | "NO_COMPLETED"
  | "FINISHED_PROVISIONAL";
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
  representedTenant?: {
    id: string;
    name: string;
    location?: string;
    jerseyImageUrl?: string;
  } | null;
  stages?: {
    stageNumber: number;
    distanceKm: number;
    startTime?: string;
    arrivalTime?: string;
    vetInTime?: string;
    heartRate?: number;
    netTimeMs?: number;
    averageSpeed?: number;
  }[];
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
  const [isClosed, setIsClosed] = useState(false);

  // Consultar estado inicial de la competencia para ver si ya está finalizada
  useEffect(() => {
    if (!competitionId) return;

    fetch(`${API_BASE_URL}/admin/competitions/${competitionId}`)
      .then((res) => {
        if (res.ok) return res.json();
        throw new Error("Failed to fetch competition");
      })
      .then((data) => {
        if (data?.status === "COMPLETED" || data?.status === "OFFICIAL") {
          setIsClosed(true);
        }
      })
      .catch((err) => {
        console.warn(
          "Could not fetch competition status, will rely on websocket:",
          err,
        );
      });
  }, [competitionId]);

  // Conexión WebSocket para recibir evento de cierre en tiempo real
  useEffect(() => {
    if (!competitionId || isClosed) return;

    const socketUrl = `${API_BASE_URL}/race`;
    console.log(
      `[WebSocket] Connecting to ${socketUrl} for competition: ${competitionId}`,
    );
    const socket = io(socketUrl, {
      transports: ["websocket"],
      autoConnect: true,
    });

    socket.on(`competition:${competitionId}:closed`, () => {
      console.log(
        `[WebSocket] Received closure signal for competition: ${competitionId}`,
      );
      setIsClosed(true);
    });

    return () => {
      socket.disconnect();
    };
  }, [competitionId, isClosed]);

  const { data, error, isLoading, mutate, isValidating } = useSWR<
    LeaderboardEntry[]
  >(
    competitionId ? `/competitions/${competitionId}/leaderboard` : null,
    fetcher,
    {
      refreshInterval: isClosed ? undefined : 30000, // Polling de alta frecuencia de 30 segundos (detenido si está cerrado)
      dedupingInterval: 4000, // Evita re-peticiones repetitivas en cascada rápida
      revalidateOnFocus: !isClosed, // Auto-actualización al enfocar la pestaña (desactivada si está cerrado)
    },
  );

  return {
    leaderboard: data || [],
    error,
    isLoading: isLoading,
    isValidating,
    mutate,
    isClosed,
  };
}
