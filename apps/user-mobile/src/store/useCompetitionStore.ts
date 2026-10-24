import { create } from "zustand";
import { Competition, LeaderboardEntry, CompetitionSubscription } from "../types";
import { api } from "../services/api";

interface CompetitionState {
  competitions: Competition[];
  activeCompetitionId: string | null;
  activeCompetition: Competition | null;
  leaderboard: LeaderboardEntry[];
  subscriptions: CompetitionSubscription[];
  isLoading: boolean;
  isLeaderboardLoading: boolean;
  isLiveSocket: boolean;
  isClosed: boolean;
  searchQuery: string;
  statusFilter: "ALL" | "ACTIVE" | "PLANNED" | "COMPLETED";
  /** Error de red al cargar competencias (null = sin error). */
  competitionsError: string | null;
  /** Error de red al cargar el leaderboard de la competencia activa. */
  leaderboardError: string | null;

  // Actions
  fetchCompetitions: () => Promise<void>;
  selectCompetition: (id: string) => Promise<void>;
  setLeaderboard: (data: LeaderboardEntry[]) => void;
  setIsLiveSocket: (isLive: boolean) => void;
  setIsClosed: (closed: boolean) => void;
  setSearchQuery: (query: string) => void;
  setStatusFilter: (filter: "ALL" | "ACTIVE" | "PLANNED" | "COMPLETED") => void;
  fetchSubscriptions: (deviceToken: string) => Promise<void>;
  toggleSubscription: (
    deviceToken: string,
    competitionId: string,
    isSubscribed: boolean,
  ) => Promise<void>;
}

export const useCompetitionStore = create<CompetitionState>((set, get) => ({
  competitions: [],
  activeCompetitionId: null,
  activeCompetition: null,
  leaderboard: [],
  subscriptions: [],
  isLoading: false,
  isLeaderboardLoading: false,
  isLiveSocket: false,
  isClosed: false,
  searchQuery: "",
  statusFilter: "ALL",
  competitionsError: null,
  leaderboardError: null,

  fetchCompetitions: async () => {
    set({ isLoading: true, competitionsError: null });
    try {
      const data = await api.getCompetitions();
      set({ competitions: data || [], isLoading: false });

      // Auto seleccionar la primera activa si no hay seleccionada
      if (!get().activeCompetitionId && data.length > 0) {
        const activeComp = data.find((c) => c.status === "ACTIVE") || data[0];
        get().selectCompetition(activeComp.id);
      }
    } catch (error) {
      if (__DEV__) console.warn("[CompetitionStore] Error fetching competitions:", error);
      set({
        isLoading: false,
        competitionsError: "No se pudo conectar con el servidor. Verifica tu conexión.",
      });
    }
  },

  selectCompetition: async (id: string) => {
    // Limpia el tablero anterior para no mostrar datos de otra competencia
    set({
      activeCompetitionId: id,
      isLeaderboardLoading: true,
      leaderboard: [],
      leaderboardError: null,
    });
    // Descarta respuestas lentas si el usuario ya eligió otra competencia
    const isStale = () => get().activeCompetitionId !== id;
    try {
      const comp = await api.getCompetitionById(id).catch(() => null);
      if (isStale()) return;
      const isEnded = comp?.status === "COMPLETED" || comp?.status === "OFFICIAL";
      set({
        activeCompetition: comp,
        isClosed: isEnded,
      });

      const lb = await api.getLeaderboard(id);
      if (isStale()) return;
      set({ leaderboard: lb || [], isLeaderboardLoading: false });
    } catch (error) {
      if (isStale()) return;
      if (__DEV__) console.warn(`[CompetitionStore] Error selecting competition ${id}:`, error);
      set({
        isLeaderboardLoading: false,
        leaderboardError: "Sin conexión. Desliza hacia abajo para reintentar.",
      });
    }
  },

  setLeaderboard: (data: LeaderboardEntry[]) => {
    set({ leaderboard: data, leaderboardError: null });
  },

  setIsLiveSocket: (isLive: boolean) => {
    set({ isLiveSocket: isLive });
  },

  setIsClosed: (closed: boolean) => {
    set({ isClosed: closed });
  },

  setSearchQuery: (query: string) => {
    set({ searchQuery: query });
  },

  setStatusFilter: (filter) => {
    set({ statusFilter: filter });
  },

  fetchSubscriptions: async (deviceToken: string) => {
    if (!deviceToken) return;
    try {
      const subs = await api.getSubscriptions(deviceToken);
      set({ subscriptions: subs });
    } catch (error) {
      console.warn("Error fetching subscriptions:", error);
    }
  },

  toggleSubscription: async (deviceToken: string, competitionId: string, isSubscribed: boolean) => {
    try {
      if (isSubscribed) {
        await api.unsubscribeCompetition(deviceToken, competitionId);
      } else {
        await api.subscribeCompetition({
          deviceToken,
          competitionId,
          notifyStatusChange: true,
          notifyStageStart: true,
          notifyVetGate: true,
          notifyOfficialResults: true,
        });
      }
      await get().fetchSubscriptions(deviceToken);
    } catch (error) {
      console.warn("Error toggling subscription:", error);
      throw error;
    }
  },
}));
