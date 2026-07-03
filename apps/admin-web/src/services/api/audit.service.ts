import { AuditLogResponse } from "@/types/audit";
import { useAuthStore } from "@/store/auth.store";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000/admin";

export interface AuditFilters {
  page?: number;
  limit?: number;
  userId?: string;
  action?: string;
  entityType?: string;
}

export const AuditService = {
  /**
   * Obtiene la lista paginada de logs de auditoría del sistema aplicando los filtros especificados.
   */
  async getAll(filters: AuditFilters): Promise<AuditLogResponse> {
    const params = new URLSearchParams();
    if (filters.page) params.append("page", filters.page.toString());
    if (filters.limit) params.append("limit", filters.limit.toString());
    if (filters.userId) params.append("userId", filters.userId);
    if (filters.action) params.append("action", filters.action);
    if (filters.entityType) params.append("entityType", filters.entityType);

    const token = useAuthStore.getState().accessToken;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_URL}/audit-logs?${params.toString()}`, {
      headers,
    });

    if (!response.ok) {
      throw new Error("Error al obtener los logs de auditoría del sistema.");
    }

    return response.json();
  },
};
