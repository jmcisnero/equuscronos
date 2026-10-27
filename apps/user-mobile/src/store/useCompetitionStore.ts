import { create } from "zustand";
import { Competition, LeaderboardEntry, CompetitionSubscription } from "../types";
import { api } from "../services/api";
import type { CompetitionBroadcast } from "../services/socket";

type FetchMode = "initial" | "refresh" | "silent";

/** Mismo orden que el backend (findAll: competitionDate DESC). */
const sortByDateDesc = (list: Competition[]) =>
  [...list].sort((a, b) => (b.competitionDate ?? "").localeCompare(a.competitionDate ?? ""));

/** Petición en curso compartida: evita ráfagas (socket + AppState + pull). */
let inflightFetch: Promise<void> | null = null;

interface CompetitionState {
  competitions: Competition[];
  activeCompetitionId: string | null;
  activeCompetition: Competition | null;
  leaderboard: LeaderboardEntry[];
  subscriptions: CompetitionSubscription[];
  isLoading: boolean;
  /** Pull-to-refresh en curso (no oculta la lista). */
  isRefreshing: boolean;
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
  /**
   * initial: muestra spinner solo si la lista está vacía.
   * refresh: pull-to-refresh (indicador nativo).
   * silent: sin indicadores (AppState / reconexión / socket).
   */
  fetchCompetitions: (mode?: FetchMode) => Promise<void>;
  /** Inserta o actualiza una competencia recibida por WebSocket. */
  upsertCompetition: (c: CompetitionBroadcast) => void;
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
  isRefreshing: false,
  isLeaderboardLoading: false,
  isLiveSocket: false,
  isClosed: false,
  searchQuery: "",
  statusFilter: "ALL",
  competitionsError: null,
  leaderboardError: null,

  fetchCompetitions: async (mode: FetchMode = "initial") => {
    if (mode === "refresh") set({ isRefreshing: true });
    if (inflightFetch) {
      await inflightFetch;
      if (mode === "refresh") set({ isRefreshing: false });
      return;
    }

    const showSpinner = mode === "initial" && get().competitions.length === 0;
    set({ isLoading: showSpinner, competitionsError: null });

    inflightFetch = (async () => {
      try {
        const data = (await api.getCompetitions()) || [];
        set({ competitions: data, isLoading: false });

        // Auto seleccionar la primera activa si no hay seleccionada
        if (!get().activeCompetitionId && data.length > 0) {
          const activeComp = data.find((c) => c.status === "ACTIVE") || data[0];
          get().selectCompetition(activeComp.id);
        }
      } catch (error) {
        if (__DEV__) console.warn("[CompetitionStore] Error fetching competitions:", error);
        // En modo silencioso conserva la lista actual sin mostrar error
        set({
          isLoading: false,
          competitionsError:
            mode === "silent" && get().competitions.length > 0
              ? get().competitionsError
              : "No se pudo conectar con el servidor. Verifica tu conexión.",
        });
      }
    })();

    try {
      await inflightFetch;
    } finally {
      inflightFetch = null;
      if (mode === "refresh") set({ isRefreshing: false });
    }
  },

  upsertCompetition: (incoming: CompetitionBroadcast) => {
    const patch: Partial<Competition> & Pick<Competition, "id"> = {
      id: incoming.id,
      name: incoming.name,
      status: incoming.status as Competition["status"],
      competitionDate: incoming.competitionDate,
      startTime: incoming.startTime ?? undefined,
      location: incoming.location ?? undefined,
      isFederated: incoming.isFederated,
      ...(incoming.tenant ? { tenant: incoming.tenant } : {}),
    };

    const { competitions, activeCompetition } = get();
    const idx = competitions.findIndex((c) => c.id === incoming.id);
    const next =
      idx >= 0
        ? competitions.map((c, i) => (i === idx ? { ...c, ...patch } : c))
        : sortByDateDesc([patch as Competition, ...competitions]);

    set({
      competitions: next,
      competitionsError: null,
      ...(activeCompetition?.id === incoming.id
        ? { activeCompetition: { ...activeCompetition, ...patch } }
        : {}),
    });
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
