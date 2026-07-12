import { useAuthStore } from "@/store/auth.store";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000/admin";

function getHeaders() {
  const token = useAuthStore.getState().accessToken;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return headers;
}

export const ContingencyService = {
  // ==========================================
  // TIMING RECORD OPERATIONS
  // ==========================================
  async updateTimingRecord(id: string, recordedAt: string): Promise<any> {
    const response = await fetch(`${API_BASE}/contingency/timing-records/${id}`, {
      method: "PATCH",
      headers: getHeaders(),
      body: JSON.stringify({ recordedAt }),
    });
    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.message || "Error al actualizar el registro de tiempo.");
    }
    return response.json();
  },

  async deleteTimingRecord(id: string): Promise<void> {
    const response = await fetch(`${API_BASE}/contingency/timing-records/${id}`, {
      method: "DELETE",
      headers: getHeaders(),
    });
    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.message || "Error al eliminar el registro de tiempo.");
    }
  },

  // ==========================================
  // VET INSPECTION OPERATIONS
  // ==========================================
  async updateVetInspection(
    id: string,
    heartRate: number,
    gaitStatus: string,
    notes?: string,
  ): Promise<any> {
    const response = await fetch(`${API_BASE}/contingency/vet-inspections/${id}`, {
      method: "PATCH",
      headers: getHeaders(),
      body: JSON.stringify({ heartRate, gaitStatus, notes }),
    });
    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.message || "Error al actualizar la inspección veterinaria.");
    }
    return response.json();
  },

  async deleteVetInspection(id: string): Promise<void> {
    const response = await fetch(`${API_BASE}/contingency/vet-inspections/${id}`, {
      method: "DELETE",
      headers: getHeaders(),
    });
    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.message || "Error al eliminar la inspección veterinaria.");
    }
  },

  // ==========================================
  // PENALTY OPERATIONS
  // ==========================================
  async createPenalty(
    entryId: string,
    stageId: string,
    timePenaltySeconds: number,
    reason: string,
  ): Promise<any> {
    const response = await fetch(`${API_BASE}/contingency/penalties`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({ entryId, stageId, timePenaltySeconds, reason }),
    });
    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.message || "Error al crear la penalización.");
    }
    return response.json();
  },

  async updatePenalty(id: string, timePenaltySeconds: number, reason: string): Promise<any> {
    const response = await fetch(`${API_BASE}/contingency/penalties/${id}`, {
      method: "PATCH",
      headers: getHeaders(),
      body: JSON.stringify({ timePenaltySeconds, reason }),
    });
    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.message || "Error al actualizar la penalización.");
    }
    return response.json();
  },

  async deletePenalty(id: string): Promise<void> {
    const response = await fetch(`${API_BASE}/contingency/penalties/${id}`, {
      method: "DELETE",
      headers: getHeaders(),
    });
    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.message || "Error al eliminar la penalización.");
    }
  },
};
