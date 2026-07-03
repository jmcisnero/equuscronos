import { User } from "./user";
import { Tenant } from "./tenant";

export interface AuditLog {
  id: string;
  action: "INSERT" | "UPDATE" | "DELETE" | "LOGIN" | "SECURITY_ALERT" | string;
  entityName: string;
  entityId: string;
  oldData?: any;
  newData?: any;
  ipAddress?: string;
  userAgent?: string;
  createdAt: string;
  user?: User | null;
  tenant?: Tenant | null;
}

export interface AuditLogResponse {
  data: AuditLog[];
  total: number;
  page: number;
  limit: number;
}
