import { create } from "zustand";
import * as SecureStore from "expo-secure-store";
import { UserProfile } from "../types";
import { api } from "../services/api";
import { registerForPushNotificationsAsync } from "../services/notifications";
import { Platform } from "react-native";

/**
 * Autenticación progresiva:
 * - Sin sesión = modo invitado (isGuest = true). Puede navegar competencias y leaderboard
 *   porque esos endpoints son públicos y no requieren JWT.
 * - Las acciones de engagement (seguir binomio, alertas de carrera) exigen login
 *   (ver ProgressiveProfilingModal / requireAuth).
 * - La sesión del aficionado se persiste en expo-secure-store.
 * - El token push se registra en el arranque también para invitados (anónimo,
 *   sin userId) para recibir avisos de nuevas competencias; tras el login el
 *   mismo token se vincula al usuario.
 */

const SESSION_KEY = "equuscronos.session.v1";

interface PersistedSession {
  token: string;
  user: UserProfile;
}

async function saveSession(session: PersistedSession): Promise<void> {
  try {
    await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(session));
  } catch (error) {
    console.warn("[Auth] No se pudo persistir la sesión:", error);
  }
}

async function loadSession(): Promise<PersistedSession | null> {
  try {
    const raw = await SecureStore.getItemAsync(SESSION_KEY);
    return raw ? (JSON.parse(raw) as PersistedSession) : null;
  } catch (error) {
    console.warn("[Auth] No se pudo leer la sesión persistida:", error);
    return null;
  }
}

async function clearSession(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(SESSION_KEY);
  } catch (error) {
    console.warn("[Auth] No se pudo borrar la sesión:", error);
  }
}

interface AuthState {
  user: UserProfile | null;
  token: string | null;
  deviceToken: string | null;
  isLoading: boolean;
  isGuest: boolean;
  optInMarketing: boolean;

  // Actions
  initializeAuth: () => Promise<void>;
  loginGoogle: (googleId: string, email: string, name: string, optInMarketing?: boolean) => Promise<void>;
  loginApple: (appleId: string, email?: string, name?: string, optInMarketing?: boolean) => Promise<void>;
  updateProfile: (name?: string, optInMarketing?: boolean) => Promise<void>;
  registerPushForCurrentUser: () => Promise<string | null>;
  logout: () => Promise<void>;
  setOptInMarketing: (value: boolean) => void;
}

export const useAuthStore = create<AuthState>((set, get) => {
  /** Aplica una sesión autenticada (no invitado), la persiste y registra el push en background. */
  const applyAuthenticatedSession = async (access_token: string, user: UserProfile) => {
    api.setToken(access_token);
    set({
      user,
      token: access_token,
      isGuest: false,
      optInMarketing: user.optInMarketing,
      isLoading: false,
    });
    await saveSession({ token: access_token, user });

    // No bloquea el flujo de login: si el push falla, el usuario sigue logueado.
    get().registerPushForCurrentUser();
  };

  return {
    user: null,
    token: null,
    deviceToken: null,
    isLoading: true,
    isGuest: true,
    optInMarketing: true,

    initializeAuth: async () => {
      set({ isLoading: true });
      const session = await loadSession();

      if (session?.token && session.user) {
        api.setToken(session.token);
        set({
          user: session.user,
          token: session.token,
          isGuest: false,
          optInMarketing: session.user.optInMarketing,
          isLoading: false,
        });
        get().registerPushForCurrentUser();
        return;
      }

      // Sin sesión: modo invitado anónimo (solo lectura pública).
      api.setToken(null);
      set({ user: null, token: null, isGuest: true, isLoading: false });
      // Registro anónimo del dispositivo (avisos de nuevas competencias)
      get().registerPushForCurrentUser();
    },

    loginGoogle: async (googleId, email, name, optInMarketing = true) => {
      set({ isLoading: true });
      try {
        const response = await api.loginGoogle({ googleId, email, name, optInMarketing });
        await applyAuthenticatedSession(response.access_token, response.user);
      } catch (error) {
        set({ isLoading: false });
        throw error;
      }
    },

    loginApple: async (appleId, email, name, optInMarketing = true) => {
      set({ isLoading: true });
      try {
        const response = await api.loginApple({ appleId, email, name, optInMarketing });
        await applyAuthenticatedSession(response.access_token, response.user);
      } catch (error) {
        set({ isLoading: false });
        throw error;
      }
    },

    updateProfile: async (name, optInMarketing) => {
      const updated = await api.updateProfile({ name, optInMarketing });
      const { user, token } = get();
      if (user) {
        const merged = { ...user, ...updated };
        set({ user: merged, optInMarketing: updated.optInMarketing });
        if (token) await saveSession({ token, user: merged });
      }
    },

    registerPushForCurrentUser: async () => {
      const { user, isGuest } = get();

      const deviceToken = await registerForPushNotificationsAsync();
      set({ deviceToken });
      if (!deviceToken) return null;

      try {
        await api.registerDeviceToken({
          deviceToken,
          userId: isGuest || !user ? undefined : user.id,
          platform: Platform.OS,
          pushProvider: "expo",
        });
      } catch (error) {
        console.warn("[Auth] No se pudo registrar el token push en el backend:", error);
      }
      return deviceToken;
    },

    logout: async () => {
      api.setToken(null);
      await clearSession();
      set({
        user: null,
        token: null,
        deviceToken: null,
        isGuest: true,
      });
    },

    setOptInMarketing: (value: boolean) => {
      set({ optInMarketing: value });
    },
  };
});
