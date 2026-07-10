import { AsyncLocalStorage } from "async_hooks";

export interface TenantStore {
  tenantId?: string;
  userId?: string;
  ipAddress?: string;
  userAgent?: string;
}

export const tenantStorage = new AsyncLocalStorage<TenantStore>();
