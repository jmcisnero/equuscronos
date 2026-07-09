import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>("roles", [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const path = request.path || request.url;
    const userRole =
      request.headers["x-role"] || (request.user && request.user.role);

    if (userRole) {
      const isMobileRole = ["USER", "TIMEKEEPER", "VET"].includes(userRole);
      const isWebAdminEndpoint = path.includes("/admin/") || path.includes("admin/");
      if (isMobileRole && isWebAdminEndpoint) {
        throw new ForbiddenException(
          "Acceso denegado: Los roles móviles no tienen permitido el acceso a la consola de administración web."
        );
      }
    }

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    if (!userRole || !requiredRoles.includes(userRole)) {
      throw new ForbiddenException("Acceso denegado: rol insuficiente.");
    }

    return true;
  }
}
