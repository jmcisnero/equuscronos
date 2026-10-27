import io, { Socket } from "socket.io-client";
import { API_BASE_URL } from "./api";

const log = (...args: unknown[]) => {
  if (__DEV__) console.log(...args);
};

interface SocketHandlers {
  onLeaderboardUpdate?: (data: any) => void;
  onCompetitionClosed?: () => void;
  /** true al conectar / reconectar; false al perder la conexión. */
  onConnectionChange?: (connected: boolean) => void;
}

/** Payload público difundido por el backend (RealTimeGateway). */
export interface CompetitionBroadcast {
  id: string;
  name: string;
  status: string;
  competitionDate: string;
  startTime?: string | null;
  location?: string | null;
  isFederated?: boolean;
  tenant?: { id: string; name: string } | null;
}

interface GlobalHandlers {
  onCompetitionCreated?: (c: CompetitionBroadcast) => void;
  onCompetitionUpdated?: (c: CompetitionBroadcast) => void;
  /** Se dispara en cada RE-conexión (no en la primera) para resincronizar. */
  onReconnect?: () => void;
}

const SOCKET_OPTIONS = {
  transports: ["websocket"],
  autoConnect: true,
  // Zonas rurales: reintenta indefinidamente con backoff (2s -> 30s)
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 2000,
  reconnectionDelayMax: 30000,
  timeout: 10000,
  // Socket independiente del de leaderboard (ciclos de vida distintos)
  forceNew: true,
};

class SocketService {
  private socket: Socket | null = null;
  private currentCompetitionId: string | null = null;

  connect(competitionId: string, handlers: SocketHandlers = {}) {
    // Siempre se recrea: evita conservar callbacks obsoletos de un montaje anterior.
    this.disconnect();

    this.currentCompetitionId = competitionId;
    const socketUrl = `${API_BASE_URL}/race`;
    log(`[SocketService] Connecting to ${socketUrl} for competition: ${competitionId}`);

    const socket = io(socketUrl, {
      transports: ["websocket"],
      autoConnect: true,
      // Zonas rurales: reintenta indefinidamente con backoff (2s -> 30s)
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 2000,
      reconnectionDelayMax: 30000,
      timeout: 10000,
    });
    this.socket = socket;

    socket.on("connect", () => {
      log(`[SocketService] Connected: ${socket.id}`);
      handlers.onConnectionChange?.(true);
    });
    socket.on("disconnect", (reason) => {
      log(`[SocketService] Disconnected: ${reason}`);
      handlers.onConnectionChange?.(false);
    });
    socket.on("connect_error", () => handlers.onConnectionChange?.(false));

    socket.on(`competition:${competitionId}:leaderboard`, (data) => {
      handlers.onLeaderboardUpdate?.(data);
    });
    socket.on(`competition:${competitionId}:closed`, () => {
      log(`[SocketService] Closed signal received for ${competitionId}`);
      handlers.onCompetitionClosed?.();
    });
  }

  disconnect() {
    if (this.socket) {
      log(`[SocketService] Disconnecting socket`);
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
      this.currentCompetitionId = null;
    }
  }

  isConnected(): boolean {
    return Boolean(this.socket && this.socket.connected);
  }

  // ---- Canal global (listado de competencias) ----
  private globalSocket: Socket | null = null;

  /** Conecta el canal global. Devuelve función de limpieza (idempotente). */
  connectGlobal(handlers: GlobalHandlers): () => void {
    this.disconnectGlobal();
    const socket = io(`${API_BASE_URL}/race`, SOCKET_OPTIONS);
    this.globalSocket = socket;
    let hasConnected = false;

    socket.on("connect", () => {
      log(`[SocketService] Global connected: ${socket.id}`);
      if (hasConnected) handlers.onReconnect?.();
      hasConnected = true;
    });
    socket.on("competition:created", (c: CompetitionBroadcast) => handlers.onCompetitionCreated?.(c));
    socket.on("competition:updated", (c: CompetitionBroadcast) => handlers.onCompetitionUpdated?.(c));

    return () => {
      if (this.globalSocket === socket) this.disconnectGlobal();
    };
  }

  /** Fuerza reconexión inmediata del canal global (p. ej. al volver a foreground). */
  ensureGlobalConnected() {
    if (this.globalSocket && !this.globalSocket.connected) this.globalSocket.connect();
  }

  disconnectGlobal() {
    if (this.globalSocket) {
      this.globalSocket.removeAllListeners();
      this.globalSocket.disconnect();
      this.globalSocket = null;
    }
  }
}

export const socketService = new SocketService();
