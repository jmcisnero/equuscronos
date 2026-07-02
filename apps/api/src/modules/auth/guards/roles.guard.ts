import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { UserRole } from "@equuscronos/shared";
import { ROLES_KEY } from "../decorators/roles.decorator";

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const path = request.path || request.url;

    // Excluir endpoints públicos de la validación de roles
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
      return true;
    }

    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }
    const { user } = request;
    if (!user) {
      return false;
    }

    const hasRole = requiredRoles.includes(user.role);
    if (!hasRole) {
      throw new ForbiddenException(
        "No tienes permisos suficientes para realizar esta acción.",
      );
    }
    return true;
  }
}
