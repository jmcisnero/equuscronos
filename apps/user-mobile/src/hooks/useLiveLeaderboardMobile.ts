import { useCallback, useEffect, useState } from "react";
import { useCompetitionStore } from "../store/useCompetitionStore";
import { socketService } from "../services/socket";
import { api } from "../services/api";

const POLL_SECONDS = 15;
/** Margen inicial para que el socket conecte antes de activar el polling de respaldo. */
const INITIAL_CONNECT_GRACE_MS = 2000;

interface LiveLeaderboardOptions {
  /**
   * false: consulta histórica (COMPLETED / OFFICIAL) o pantalla sin foco.
   * No abre WebSocket ni polling; los datos llegan por REST (selectCompetition / refresh).
   */
  live?: boolean;
}

export function useLiveLeaderboardMobile(
  competitionId: string | null,
  { live = true }: LiveLeaderboardOptions = {},
) {
  const {
    leaderboard,
    setLeaderboard,
    isLeaderboardLoading,
    isClosed,
    setIsClosed,
    setIsLiveSocket,
  } = useCompetitionStore();

  const [countdown, setCountdown] = useState(POLL_SECONDS);
  const [isFallbackPolling, setIsFallbackPolling] = useState(false);

  /** REST: descarta respuestas de una competencia que ya no está activa. */
  const fetchRest = useCallback(async () => {
    if (!competitionId) return;
    try {
      const data = await api.getLeaderboard(competitionId);
      if (data && useCompetitionStore.getState().activeCompetitionId === competitionId) {
        setLeaderboard(data);
      }
    } catch (err) {
      if (__DEV__) console.warn("[useLiveLeaderboardMobile] REST error:", err);
    }
  }, [competitionId, setLeaderboard]);

  useEffect(() => {
    if (!competitionId) return;
    if (!live) {
      // Resultados históricos: sin tiempo real innecesario
      setIsFallbackPolling(false);
      return;
    }

    let isSubscribed = true;
    let hasConnectedOnce = false;

    socketService.connect(competitionId, {
      onLeaderboardUpdate: (data) => {
        if (!isSubscribed) return;
        setLeaderboard(data);
        setCountdown(POLL_SECONDS);
      },
      onCompetitionClosed: () => {
        if (isSubscribed) setIsClosed(true);
      },
      onConnectionChange: (connected) => {
        if (!isSubscribed) return;
        setIsLiveSocket(connected);
        // Caída de señal en cualquier momento -> polling REST de respaldo.
        setIsFallbackPolling(!connected);
        if (connected) {
          // Reconexión: recupera eventos perdidos durante el corte.
          if (hasConnectedOnce) fetchRest();
          hasConnectedOnce = true;
          setCountdown(POLL_SECONDS);
        }
      },
    });

    const graceTimeout = setTimeout(() => {
      if (isSubscribed && !socketService.isConnected()) {
        setIsLiveSocket(false);
        setIsFallbackPolling(true);
      }
    }, INITIAL_CONNECT_GRACE_MS);

    return () => {
      isSubscribed = false;
      clearTimeout(graceTimeout);
      socketService.disconnect();
      // Evita que el header muestre "EN VIVO" con un socket ya cerrado.
      setIsLiveSocket(false);
    };
  }, [competitionId, live, fetchRest]);

  // Temporizador regresivo del polling REST de resguardo
  useEffect(() => {
    if (!live || isClosed || !isFallbackPolling || !competitionId) return;

    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          fetchRest();
          return POLL_SECONDS;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [competitionId, isClosed, isFallbackPolling, live, fetchRest]);

  return {
    leaderboard,
    isLoading: isLeaderboardLoading,
    isClosed,
    isFallbackPolling: live && isFallbackPolling,
    countdown,
    refresh: async () => {
      await fetchRest();
      setCountdown(POLL_SECONDS);
    },
  };
}
