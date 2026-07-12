import { useAuthStore } from "@/store/auth.store";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000/admin";

// The timing endpoints are at the API root, not under /admin
const TIMING_API_URL = API_URL.replace(/\/admin$/, "");

function getAuthHeaders(): Record<string, string> {
  const token = useAuthStore.getState().accessToken;
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export type TimeRecordType = "START" | "ARRIVAL" | "VET_IN" | "VET_OUT";

export interface CreateTimingRecordDto {
  competitionId: string;
  stageId: string;
  bibNumber?: number;
  chipId?: string;
  recordType: TimeRecordType;
  recordedAt: string; // ISO 8601
  isApproved?: boolean;
  isAutomatic?: boolean;
}

export interface TimingRecordResult {
  id: string;
  recordType: TimeRecordType;
  recordedAt: string;
  isApproved: boolean;
  eliminationType?: string | null;
  eliminationReason?: string | null;
  eliminated?: boolean;
}

export const TimingService = {
  /**
   * Registers a manual contingency timing record.
   * Hits POST /timing — the same endpoint used by the field-mobile app.
   * Requires Bearer token with roles: ADMIN, CLUB_ADMIN, JUDGE, or TIMEKEEPER.
   */
  async createRecord(dto: CreateTimingRecordDto): Promise<TimingRecordResult> {
    const response = await fetch(`${TIMING_API_URL}/timing`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({
        ...dto,
        isAutomatic: false, // Always false from admin contingency console
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      const message = Array.isArray(err?.message)
        ? err.message.join(". ")
        : err?.message || `Error HTTP ${response.status}`;
      const error = new Error(message) as Error & {
        statusCode: number;
        raw: unknown;
      };
      (error as any).statusCode = response.status;
      (error as any).raw = err;
      throw error;
    }

    return response.json();
  },

  /**
   * Fetches active/planned competitions for the current tenant.
   * Used to populate the competition selector in the contingency form.
   */
  async getActiveCompetitions(): Promise<
    {
      id: string;
      name: string;
      status: string;
      stages: { id: string; stageNumber: number; distanceKm: number }[];
    }[]
  > {
    const response = await fetch(`${API_URL}/competitions`, {
      headers: getAuthHeaders(),
    });
    if (!response.ok) {
      throw new Error("Error al cargar las competencias activas.");
    }
    const all = await response.json();
    return all.filter((c: any) => ["ACTIVE", "PLANNED"].includes(c.status));
  },
};
