import {
  Injectable,
  ExecutionContext,
  UnauthorizedException,
} from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";

@Injectable()
export class JwtAuthGuard extends AuthGuard("jwt") {
  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();
    const path = request.path || request.url;

    // Excluir endpoints públicos como login, el leaderboard y listar competencias
    const isPublic =
      path.includes("/auth/login") ||
      path.includes("auth/login") ||
      path.includes("/leaderboard") ||
      path.includes("leaderboard") ||
      path.includes("/uploads") ||
      path.includes("uploads") ||
      (path.includes("/admin/competitions") && request.method === "GET") ||
      (path.includes("admin/competitions") && request.method === "GET");
    if (isPublic) {
      const authHeader = request.headers["authorization"];
      if (authHeader) {
        try {
          const result = super.canActivate(context);
          if (result instanceof Promise) {
            return await result;
          }
          if (typeof result === "boolean") {
            return result;
          }
          const { firstValueFrom } = require("rxjs");
          return await firstValueFrom(result);
        } catch (e) {
          return true;
        }
      }
      return true;
    }

    // Bypass en desarrollo si no hay token de autorización (para el admin-web)
    const authHeader = request.headers["authorization"];
    if (!authHeader && process.env.NODE_ENV === "development") {
      request.user = {
        id: "a2000000-0000-0000-0000-000000000001", // Melo seeded admin user ID
        email: "admin@equuscronos.com",
        role: "ADMIN",
        tenantId: "",
      };
      return true;
    }

    return super.canActivate(context);
  }

  handleRequest(err: any, user: any, info: any) {
    if (err || !user) {
      throw (
        err ||
        new UnauthorizedException("No autorizado. Token inválido o ausente.")
      );
    }
    return user;
  }
}
