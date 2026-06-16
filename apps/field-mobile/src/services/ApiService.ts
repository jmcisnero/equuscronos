import axios, { AxiosInstance } from "axios";
import * as SecureStore from "expo-secure-store";
import { LocalTimingRecord, LocalVetInspection } from "../database/schema";
import { getDatabase } from "../database/db";
import { UserRole } from "@equuscronos/shared";

const DEFAULT_API_BASE_URL = "http://192.168.1.24:3000";

class ApiService {
  private client: AxiosInstance;
  private currentBaseUrl: string = DEFAULT_API_BASE_URL;

  constructor() {
    this.client = axios.create({
      baseURL: this.currentBaseUrl,
      timeout: 10000,
      headers: {
        "Content-Type": "application/json",
        // Default tenant header for development multitenancy
        "x-tenant-id": "77777777-7777-7777-7777-777777777777",
      },
    });

    // Interceptor de peticiones para inyectar dinámicamente el token JWT desde el almacenamiento seguro
    this.client.interceptors.request.use(
      async (config) => {
        config.baseURL = this.currentBaseUrl;
        try {
          const token = await SecureStore.getItemAsync("auth_token");
          if (token) {
            config.headers["Authorization"] = `Bearer ${token}`;
          }
        } catch (error) {
          console.warn(
            "No se pudo recuperar el token de autenticación de SecureStore:",
            error,
          );
        }
        return config;
      },
      (error) => Promise.reject(error),
    );
  }

  getBaseUrl(): string {
    return this.currentBaseUrl;
  }

  setBaseUrl(url: string) {
    this.currentBaseUrl = url;
  }

  private async validateRole(allowedRoles: UserRole[]) {
    try {
      const userJson = await SecureStore.getItemAsync("auth_user");
      if (!userJson) {
        throw new Error("Acceso denegado: Usuario no autenticado.");
      }
      const user = JSON.parse(userJson);
      if (!allowedRoles.includes(user.role)) {
        throw new Error(
          `Acceso denegado: El rol '${user.role}' no tiene permisos para esta acción.`,
        );
      }
    } catch (error: any) {
      throw new Error(
        error.message || "Error de validación de rol preventivo.",
      );
    }
  }

  /**
   * Syncs a timing record to the backend Postgres DB mapping SQLite layout to CreateTimingRecordDto
   */
  async syncTimingRecord(record: LocalTimingRecord): Promise<any> {
    await this.validateRole([
      UserRole.TIMEKEEPER,
      UserRole.JUDGE,
      UserRole.ADMIN,
    ]);
    const db = await getDatabase();

    // Retrieve competition_id and bib_number from local SQLite entries cache
    const entry = await db.getFirstAsync<{
      competition_id: string;
      bib_number: number;
    }>(
      "SELECT competition_id, bib_number FROM competition_entries WHERE id = ?;",
      [record.entry_id],
    );

    if (!entry) {
      throw new Error(
        `Local competitor entry with ID ${record.entry_id} not found.`,
      );
    }

    const payload = {
      competitionId: entry.competition_id,
      stageId: record.stage_id,
      bibNumber: entry.bib_number,
      recordType: record.record_type,
      recordedAt: record.recorded_at,
      isApproved: record.is_approved === 1,
      eliminationType: record.elimination_type || undefined,
      eliminationReason: record.elimination_reason || undefined,
    };

    const endpoint =
      record.record_type === "VET_IN" ? "/timing/vet-in" : "/timing";
    const response = await this.client.post(endpoint, payload);
    return response.data;
  }

  /**
   * Updates an existing timing record in the backend Postgres DB
   */
  async updateTimingRecord(
    id: string,
    payload: { recordedAt: string },
  ): Promise<any> {
    await this.validateRole([
      UserRole.TIMEKEEPER,
      UserRole.JUDGE,
      UserRole.ADMIN,
    ]);
    const response = await this.client.patch(`/timing/${id}`, payload);
    return response.data;
  }

  /**
   * Voids an existing timing record in the backend Postgres DB
   */
  async voidTimingRecord(
    id: string,
    payload: { voidReason: string },
  ): Promise<any> {
    await this.validateRole([
      UserRole.TIMEKEEPER,
      UserRole.JUDGE,
      UserRole.ADMIN,
    ]);
    const response = await this.client.patch(`/timing/${id}/void`, payload);
    return response.data;
  }

  /**
   * Syncs a vet inspection record to the backend Postgres DB mapping to CreateVetInspectionDto
   */
  async syncVetInspection(inspection: LocalVetInspection): Promise<any> {
    await this.validateRole([UserRole.VET, UserRole.ADMIN]);
    const payload = {
      timingRecordId: inspection.timing_record_id,
      heartRate: inspection.heart_rate,
      temperature: inspection.temperature || undefined,
      motricity: inspection.motricity,
      metabolic: inspection.metabolic,
      notes: inspection.notes || undefined,
    };

    const response = await this.client.post("/vet-inspections", payload);
    return response.data;
  }

  /**
   * Syncs a competition entry status update to the backend Postgres DB
   */
  async syncEntryStatus(entryId: string, status: string): Promise<any> {
    await this.validateRole([
      UserRole.TIMEKEEPER,
      UserRole.JUDGE,
      UserRole.VET,
      UserRole.ADMIN,
    ]);
    const response = await this.client.patch(`/admin/entries/${entryId}`, {
      status,
    });
    return response.data;
  }

  /**
   * Fetches latest entries from backend to update local cache
   */
  async fetchLatestEntries(competitionId: string): Promise<any[]> {
    await this.validateRole([
      UserRole.TIMEKEEPER,
      UserRole.JUDGE,
      UserRole.VET,
      UserRole.ADMIN,
    ]);
    const response = await this.client.get(
      `/admin/entries?competitionId=${competitionId}`,
    );
    return response.data;
  }

  /**
   * Fetches all competitions from backend
   */
  async fetchCompetitions(): Promise<any[]> {
    await this.validateRole([
      UserRole.TIMEKEEPER,
      UserRole.JUDGE,
      UserRole.VET,
      UserRole.ADMIN,
    ]);
    const response = await this.client.get("/admin/competitions");
    return response.data;
  }

  /**
   * Almacena de forma segura el token JWT en el dispositivo
   */
  async setToken(token: string): Promise<void> {
    await SecureStore.setItemAsync("auth_token", token);
  }

  /**
   * Obtiene el token JWT del almacenamiento seguro
   */
  async getToken(): Promise<string | null> {
    try {
      return await SecureStore.getItemAsync("auth_token");
    } catch {
      return null;
    }
  }

  /**
   * Elimina el token JWT del almacenamiento seguro
   */
  async clearToken(): Promise<void> {
    await SecureStore.deleteItemAsync("auth_token");
  }
}

export default new ApiService();
