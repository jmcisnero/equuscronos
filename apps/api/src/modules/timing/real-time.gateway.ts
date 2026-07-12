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
}
