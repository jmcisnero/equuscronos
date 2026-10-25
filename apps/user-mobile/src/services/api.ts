import { NativeModules } from "react-native";
import Constants from "expo-constants";
import { Competition, LeaderboardEntry, UserProfile, CompetitionSubscription } from "../types";

const API_PORT = 3000;

/**
 * En desarrollo, obtiene el host de la PC que sirve el bundle de Metro.
 * El backend corre en la misma máquina, así que la IP LAN se resuelve sola
 * aunque cambie (DHCP).
 *
 * 1. expo-constants `hostUri` ("192.168.1.23:8081"): funciona en Expo Go y
 *    development builds con la Nueva Arquitectura (SDK 52+).
 * 2. `NativeModules.SourceCode.scriptURL`: solo arquitectura antigua (fallback).
 */
function getDevServerHost(): string | null {
  const hostUri: string | undefined =
    Constants.expoConfig?.hostUri ?? (Constants as any).expoGoConfig?.debuggerHost;
  const fromHostUri = hostUri?.split(":")[0];
  if (fromHostUri) return fromHostUri;

  const scriptURL: string | undefined = NativeModules?.SourceCode?.scriptURL;
  const match = scriptURL?.match(/^\w+:\/\/([^/:]+)/);
  return match ? match[1] : null;
}

function resolveApiBaseUrl(): string {
  const explicit = process.env.EXPO_PUBLIC_API_URL;
  // 1. Override explícito (ej. staging / producción / túnel)
  if (explicit) {
    // Release: solo tráfico cifrado (https -> Socket.IO usa wss automáticamente)
    if (!__DEV__ && !/^https:\/\//i.test(explicit)) {
      console.error(`[API] EXPO_PUBLIC_API_URL debe usar https:// en producción (recibido: ${explicit})`);
    }
    return explicit;
  }
  // 2. Dev: misma IP que Metro
  if (__DEV__) {
    const host = getDevServerHost();
    if (host) return `http://${host}:${API_PORT}`;
    return `http://localhost:${API_PORT}`;
  }
  // 3. Release sin URL configurada: error de configuración del build (eas.json -> env)
  console.error("[API] Falta EXPO_PUBLIC_API_URL en el perfil de build de producción.");
  return "";
}

export const API_BASE_URL = resolveApiBaseUrl().replace(/\/+$/, "");

if (__DEV__) console.log(`[API] Base URL: ${API_BASE_URL}`);

const REQUEST_TIMEOUT_MS = 15000;

type RequestOptions = RequestInit & {
  /** false = endpoint de lectura pública: nunca se envía el header Authorization */
  auth?: boolean;
};

class ApiClient {
  private token: string | null = null;

  setToken(token: string | null) {
    this.token = token;
  }

  private async request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
    const { auth = true, ...init } = options;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(init.headers as Record<string, string>),
    };

    if (auth && this.token) {
      headers["Authorization"] = `Bearer ${this.token}`;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        ...init,
        headers,
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorPayload = await response.json().catch(() => ({}));
        const message = errorPayload.message || `HTTP error! status: ${response.status}`;
        throw new Error(message);
      }

      return response.json();
    } catch (error: any) {
      if (error?.name === "AbortError") {
        throw new Error(`Timeout conectando a ${API_BASE_URL}${endpoint}`);
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  // ---- Lectura pública (mismos endpoints que apps/public-web, sin JWT) ----
  async getCompetitions(): Promise<Competition[]> {
    return this.request<Competition[]>("/admin/competitions", { auth: false });
  }

  async getCompetitionById(id: string): Promise<Competition> {
    return this.request<Competition>(`/admin/competitions/${id}`, { auth: false });
  }

  async getLeaderboard(competitionId: string): Promise<LeaderboardEntry[]> {
    return this.request<LeaderboardEntry[]>(`/competitions/${competitionId}/leaderboard`, {
      auth: false,
    });
  }

  // Auth Public
  async loginGoogle(payload: {
    googleId: string;
    email: string;
    name: string;
    optInMarketing?: boolean;
  }) {
    return this.request<{ access_token: string; user: UserProfile }>("/auth/public/google", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  async loginApple(payload: {
    appleId: string;
    email?: string;
    name?: string;
    optInMarketing?: boolean;
  }) {
    return this.request<{ access_token: string; user: UserProfile }>("/auth/public/apple", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  async loginGuest(payload: { optInMarketing?: boolean } = {}) {
    return this.request<{ access_token: string; user: UserProfile }>("/auth/public/guest", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  async updateProfile(payload: { name?: string; optInMarketing?: boolean }) {
    return this.request<UserProfile>("/auth/public/profile", {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  }

  // Notifications
  async registerDeviceToken(payload: {
    deviceToken: string;
    platform?: string;
    pushProvider?: string;
    userId?: string;
  }) {
    return this.request<{ success: boolean; data: any }>("/notifications/register-token", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  async subscribeCompetition(payload: {
    deviceToken: string;
    competitionId: string;
    notifyStatusChange?: boolean;
    notifyStageStart?: boolean;
    notifyVetGate?: boolean;
    notifyOfficialResults?: boolean;
  }) {
    return this.request<{ success: boolean; data: any }>("/notifications/subscribe", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  async unsubscribeCompetition(deviceToken: string, competitionId: string) {
    return this.request<{ success: boolean }>("/notifications/unsubscribe", {
      method: "POST",
      body: JSON.stringify({ deviceToken, competitionId }),
    });
  }

  async getSubscriptions(deviceToken: string): Promise<CompetitionSubscription[]> {
    const res = await this.request<{ success: boolean; data: CompetitionSubscription[] }>(
      `/notifications/subscriptions?deviceToken=${encodeURIComponent(deviceToken)}`,
    );
    return res.data || [];
  }
}

export const api = new ApiClient();
