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
    const tenantId =
      request.user?.role === "ADMIN" ? "" : request.user?.tenantId || "";
    const userId = request.user?.id || "";

    // Ejecutamos el flujo de la solicitud dentro del contexto del AsyncLocalStorage
    return new Observable((subscriber) => {
      tenantStorage.run({ tenantId, userId }, () => {
        next.handle().subscribe({
          next: (val) => subscriber.next(val),
          error: (err) => subscriber.error(err),
          complete: () => subscriber.complete(),
        });
      });
    });
  }
}
