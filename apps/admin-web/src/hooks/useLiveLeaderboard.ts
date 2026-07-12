import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import io from "socket.io-client";

export interface LeaderboardStage {
  stageNumber: number;
  distanceKm: number;
  startTime?: string;
  arrivalTime?: string;
  vetInTime?: string;
  heartRate?: number;
  netTimeMs?: number;
  averageSpeed?: number;
}

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
    | "NO_COMPLETED";
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
  stages?: LeaderboardStage[];
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

export function useLiveLeaderboard(competitionId: string) {
  const queryClient = useQueryClient();

  const {
    data: leaderboard = [],
    isLoading,
    error,
    refetch,
  } = useQuery<LeaderboardEntry[]>({
    queryKey: ["liveLeaderboard", competitionId],
    queryFn: async () => {
      const path = `/competitions/${competitionId}/leaderboard`;
      const res = await fetch(`${API_BASE_URL.replace(/\/admin$/, "")}${path}`);
      if (!res.ok) {
        throw new Error(
          "Error al obtener la tabla de posiciones en tiempo real.",
        );
      }
      return res.json();
    },
    enabled: !!competitionId,
    staleTime: 5000,
  });

  useEffect(() => {
    if (!competitionId) return;

    const socketUrl = `${API_BASE_URL.replace(/\/admin$/, "")}/race`;
    const socket = io(socketUrl, {
      transports: ["websocket"],
      autoConnect: true,
    });

    socket.on(`competition:${competitionId}:leaderboard`, (updatedData) => {
      queryClient.setQueryData(["liveLeaderboard", competitionId], updatedData);
    });

    return () => {
      socket.disconnect();
    };
  }, [competitionId, queryClient]);

  return {
    leaderboard,
    isLoading,
    error,
    refetch,
  };
}
