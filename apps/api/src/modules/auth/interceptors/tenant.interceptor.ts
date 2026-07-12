import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from "@nestjs/common";
import { Observable } from "rxjs";
import { tap } from "rxjs/operators";
import { tenantStorage } from "../tenant.storage";

@Injectable()
export class TenantInterceptor implements NestInterceptor {
  private readonly logger = new Logger("TenantInterceptor");

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const url = request.url;
    const isLoginRoute = url.includes("/auth/login");
    const tenantId = isLoginRoute
      ? ""
      : request.user?.role === "ADMIN"
        ? ""
        : request.user?.tenantId || request.headers["x-tenant-id"] || "";
    const userId = request.user?.id || "";
    const ipAddress =
      (request.headers["x-forwarded-for"] as string) ||
      request.ip ||
      request.connection?.remoteAddress ||
      "";
    const userAgent = request.headers["user-agent"] || "";
    const method = request.method;
    const start = Date.now();

    // Ejecutamos el flujo de la solicitud dentro del contexto del AsyncLocalStorage
    return new Observable((subscriber) => {
      tenantStorage.run({ tenantId, userId, ipAddress, userAgent }, () => {
        next
          .handle()
          .pipe(
            tap({
              next: () => {
                const duration = Date.now() - start;
                this.logger.log(
                  `[API Request] ${method} ${url} | Tenant: ${tenantId || "NONE"} | User: ${userId || "ANONYMOUS"} | Status: SUCCESS | Duration: ${duration}ms`,
                );
              },
              error: (err) => {
                const duration = Date.now() - start;
                this.logger.error(
                  `[API Request] ${method} ${url} | Tenant: ${tenantId || "NONE"} | User: ${userId || "ANONYMOUS"} | Status: ERROR (${err.message || err.status || "Unknown error"}) | Duration: ${duration}ms`,
                );
              },
            }),
          )
          .subscribe({
            next: (val) => subscriber.next(val),
            error: (err) => subscriber.error(err),
            complete: () => subscriber.complete(),
          });
      });
    });
  }
}
