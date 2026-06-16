import { Tenant, CreateTenantDto, UpdateTenantDto } from "@/types/tenant";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000/admin";

export const TenantService = {
  /**
   * Obtiene todos los clubes/organizaciones registrados en la plataforma.
   */
  async getAll(): Promise<Tenant[]> {
    const url = `${API_URL}/tenants`;
    const response = await fetch(url);
    if (!response.ok)
      throw new Error("Error al cargar la lista de clubes/organizaciones");
    return response.json();
  },

  /**
   * Obtiene un club específico por UUID.
   */
  async getById(id: string): Promise<Tenant> {
    const url = `${API_URL}/tenants/${id}`;
    const response = await fetch(url);
    if (!response.ok)
      throw new Error("Error al obtener la organización especificada");
    return response.json();
  },

  /**
   * Registra un nuevo club/tenant en el sistema.
   */
  async create(dto: CreateTenantDto): Promise<Tenant> {
    const response = await fetch(`${API_URL}/tenants`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(dto),
    });
    if (!response.ok) {
      const err = await response.json();
      const friendlyMessage = Array.isArray(err.message)
        ? err.message.join(". ")
        : err.message || "Error al registrar la organización";
      throw new Error(friendlyMessage);
    }
    return response.json();
  },

  /**
   * Modifica la información de un club existente.
   */
  async update(id: string, dto: UpdateTenantDto): Promise<Tenant> {
    const response = await fetch(`${API_URL}/tenants/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(dto),
    });
    if (!response.ok) {
      const err = await response.json();
      const friendlyMessage = Array.isArray(err.message)
        ? err.message.join(". ")
        : err.message || "Error al actualizar la organización";
      throw new Error(friendlyMessage);
    }
    return response.json();
  },

  /**
   * Elimina un club del sistema de forma inmutable si no tiene dependencias activas.
   */
  async delete(id: string): Promise<void> {
    const response = await fetch(`${API_URL}/tenants/${id}`, {
      method: "DELETE",
    });
    if (!response.ok) {
      const err = await response.json();
      throw new Error(
        err.message ||
          "Error al eliminar la organización por restricciones de integridad",
      );
    }
  },
};
