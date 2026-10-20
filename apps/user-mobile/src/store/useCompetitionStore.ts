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

  fetchCompetitions: async () => {
    set({ isLoading: true });
    try {
      const data = await api.getCompetitions();
      set({ competitions: data || [], isLoading: false });

      // Auto seleccionar la primera activa si no hay seleccionada
      if (!get().activeCompetitionId && data.length > 0) {
        const activeComp = data.find((c) => c.status === "ACTIVE") || data[0];
        get().selectCompetition(activeComp.id);
      }
    } catch (error) {
      console.warn("[CompetitionStore] Error fetching competitions:", error);
      set({ isLoading: false });
    }
  },

  selectCompetition: async (id: string) => {
    set({ activeCompetitionId: id, isLeaderboardLoading: true });
    try {
      const comp = await api.getCompetitionById(id).catch(() => null);
      const isEnded = comp?.status === "COMPLETED" || comp?.status === "OFFICIAL";
      set({
        activeCompetition: comp,
        isClosed: isEnded,
      });

      const lb = await api.getLeaderboard(id);
      set({ leaderboard: lb || [], isLeaderboardLoading: false });
    } catch (error) {
      console.warn(`[CompetitionStore] Error selecting competition ${id}:`, error);
      set({ isLeaderboardLoading: false });
    }
  },

  setLeaderboard: (data: LeaderboardEntry[]) => {
    set({ leaderboard: data });
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
