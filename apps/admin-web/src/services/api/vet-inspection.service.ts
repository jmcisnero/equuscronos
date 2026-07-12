import { useAuthStore } from "@/store/auth.store";

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000/admin").replace(/\/admin$/, "");

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

export const VetInspectionService = {
  async create(dto: {
    competitionId: string;
    vetGateNumber: number;
    riderDorsal: string;
    arrivalTime: string;
    vetInTime: string;
    heartRate: number;
    gaitStatus: string;
    inspectionType: string;
    requiresRecheck: boolean;
    notes?: string;
  }): Promise<any> {
    const response = await fetch(`${API_BASE}/vet-inspections`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify(dto),
    });
    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.message || "Error al registrar la inspección veterinaria.");
    }
    return response.json();
  },
};
