import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from "@nestjs/common";
import { Observable } from "rxjs";
import { tenantStorage } from "../tenant.storage";

@Injectable()
export class TenantInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    // Extraemos el tenantId del usuario autenticado (inyectado por Passport-JWT)
    // Si el usuario tiene el rol ADMIN, no limitamos su tenant (bypassea RLS)
    const tenantId =
      request.user?.role === "ADMIN" ? "" : request.user?.tenantId || "";

    // Ejecutamos el flujo de la solicitud dentro del contexto del AsyncLocalStorage
    return new Observable((subscriber) => {
      tenantStorage.run({ tenantId }, () => {
        next.handle().subscribe({
          next: (val) => subscriber.next(val),
          error: (err) => subscriber.error(err),
          complete: () => subscriber.complete(),
        });
      });
    });
  }
}
