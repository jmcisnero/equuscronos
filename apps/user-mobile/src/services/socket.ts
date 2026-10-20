import io, { Socket } from "socket.io-client";
import { API_BASE_URL } from "./api";

class SocketService {
  private socket: Socket | null = null;
  private currentCompetitionId: string | null = null;

  connect(competitionId: string, onLeaderboardUpdate?: (data: any) => void, onCompetitionClosed?: () => void) {
    if (this.socket && this.currentCompetitionId === competitionId && this.socket.connected) {
      return;
    }

    this.disconnect();

    this.currentCompetitionId = competitionId;
    const socketUrl = `${API_BASE_URL}/race`;

    console.log(`[SocketService] Connecting to ${socketUrl} for competition: ${competitionId}`);

    this.socket = io(socketUrl, {
      transports: ["websocket"],
      autoConnect: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
    });

    this.socket.on("connect", () => {
      console.log(`[SocketService] Connected with socket ID: ${this.socket?.id}`);
    });

    this.socket.on(`competition:${competitionId}:leaderboard`, (data) => {
      console.log(`[SocketService] Leaderboard update received for ${competitionId}`);
      if (onLeaderboardUpdate) {
        onLeaderboardUpdate(data);
      }
    });

    this.socket.on(`competition:${competitionId}:closed`, () => {
      console.log(`[SocketService] Closed signal received for ${competitionId}`);
      if (onCompetitionClosed) {
        onCompetitionClosed();
      }
    });

    this.socket.on("disconnect", (reason) => {
      console.log(`[SocketService] Disconnected: ${reason}`);
    });
  }

  disconnect() {
    if (this.socket) {
      console.log(`[SocketService] Disconnecting socket`);
      this.socket.disconnect();
      this.socket = null;
      this.currentCompetitionId = null;
    }
  }

  isConnected(): boolean {
    return Boolean(this.socket && this.socket.connected);
  }
}

export const socketService = new SocketService();
