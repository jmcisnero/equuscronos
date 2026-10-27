import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from "@nestjs/websockets";
import { Server } from "socket.io";

@WebSocketGateway({
  cors: {
    origin: "*",
  },
  namespace: "race",
})
export class RealTimeGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  handleConnection(client: any) {
    console.log(`[RealTimeGateway] Client connected: ${client.id}`);
  }

  handleDisconnect(client: any) {
    console.log(`[RealTimeGateway] Client disconnected: ${client.id}`);
  }

  emitLeaderboardUpdate(competitionId: string, leaderboard: any) {
    if (this.server) {
      this.server.emit(`competition:${competitionId}:leaderboard`, leaderboard);
    }
  }

  emitRaceClosed(competitionId: string) {
    if (this.server) {
      this.server.emit(`competition:${competitionId}:closed`, {
        competitionId,
        closed: true,
      });
    }
  }

  /** Evento global: nueva competencia publicada (listado del Explorer). */
  emitCompetitionCreated(payload: CompetitionBroadcastPayload) {
    this.server?.emit("competition:created", payload);
  }

  /** Evento global: cambio de datos/estado de una competencia existente. */
  emitCompetitionUpdated(payload: CompetitionBroadcastPayload) {
    this.server?.emit("competition:updated", payload);
  }
}

/** Datos públicos mínimos difundidos a clientes anónimos (sin datos sensibles). */
export interface CompetitionBroadcastPayload {
  id: string;
  name: string;
  status: string;
  competitionDate: string | Date;
  startTime?: string | null;
  location?: string | null;
  isFederated?: boolean;
  tenant?: { id: string; name: string } | null;
}
