import { useEffect, useState, useRef } from "react";
import { useCompetitionStore } from "../store/useCompetitionStore";
import { socketService } from "../services/socket";
import { api } from "../services/api";

export function useLiveLeaderboardMobile(competitionId: string | null) {
  const {
    leaderboard,
    setLeaderboard,
    isLeaderboardLoading,
    isClosed,
    setIsClosed,
    setIsLiveSocket,
  } = useCompetitionStore();

  const [countdown, setCountdown] = useState(15);
  const [isFallbackPolling, setIsFallbackPolling] = useState(false);

  useEffect(() => {
    if (!competitionId) return;

    let isSubscribed = true;

    // Conectar WebSocket
    socketService.connect(
      competitionId,
      (data) => {
        if (isSubscribed) {
          console.log("[useLiveLeaderboardMobile] Realtime Socket update received");
          setLeaderboard(data);
          setIsLiveSocket(true);
          setIsFallbackPolling(false);
          setCountdown(15);
        }
      },
      () => {
        if (isSubscribed) {
          console.log("[useLiveLeaderboardMobile] Competition Closed Signal");
          setIsClosed(true);
        }
      },
    );

    // Chequear si el socket logró conectarse
    const checkSocketTimeout = setTimeout(() => {
      if (!socketService.isConnected()) {
        console.log("[useLiveLeaderboardMobile] Socket not connected. Enabling REST Polling fallback.");
        setIsLiveSocket(false);
        setIsFallbackPolling(true);
      } else {
        setIsLiveSocket(true);
        setIsFallbackPolling(false);
      }
    }, 2000);

    return () => {
      isSubscribed = false;
      clearTimeout(checkSocketTimeout);
      socketService.disconnect();
    };
  }, [competitionId]);

  // Manejador del temporizador regresivo para REST Polling de resguardo
  useEffect(() => {
    if (isClosed || !isFallbackPolling || !competitionId) return;

    const interval = setInterval(async () => {
      setCountdown((prev) => {
        if (prev <= 1) {
          // Ejecutar refresh REST de resguardo
          api.getLeaderboard(competitionId)
            .then((data) => {
              if (data) setLeaderboard(data);
            })
            .catch((err) => console.warn("Polling REST error:", err));
          return 15;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [competitionId, isClosed, isFallbackPolling]);

  return {
    leaderboard,
    isLoading: isLeaderboardLoading,
    isClosed,
    isFallbackPolling,
    countdown,
    refresh: async () => {
      if (competitionId) {
        const data = await api.getLeaderboard(competitionId);
        setLeaderboard(data);
        setCountdown(15);
      }
    },
  };
}
