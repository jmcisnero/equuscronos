import React, { useCallback, useEffect, useRef } from "react";
import { AppState, AppStateStatus } from "react-native";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  addNotificationListeners,
  getInitialNotificationData,
} from "./src/services/notifications";
import { socketService } from "./src/services/socket";
import { AppNavigator, navigationRef } from "./src/navigation/AppNavigator";
import { useAuthStore } from "./src/store/useAuthStore";
import { useCompetitionStore } from "./src/store/useCompetitionStore";
import { useTheme, useThemeStore } from "./src/theme/useTheme";

const queryClient = new QueryClient();

/** Agrupa ráfagas de eventos en una sola resincronización REST. */
const RESYNC_DEBOUNCE_MS = 800;

export default function App() {
  const { initializeAuth } = useAuthStore();
  const { isDark, colors } = useTheme();
  const hydrateTheme = useThemeStore((s) => s.hydrate);

  const pendingCompetitionId = useRef<string | null>(null);
  const handledColdStart = useRef(false);

  /** Abre la competencia de una notificación (o la deja pendiente si la navegación no está lista). */
  const openCompetition = useCallback(async (competitionId: string) => {
    if (!navigationRef.isReady()) {
      pendingCompetitionId.current = competitionId;
      return;
    }
    pendingCompetitionId.current = null;
    const store = useCompetitionStore.getState();
    await store.selectCompetition(competitionId);
    const status = useCompetitionStore.getState().activeCompetition?.status;
    const concluded = status === "COMPLETED" || status === "OFFICIAL";
    navigationRef.navigate(concluded ? "ResultsTab" : "LiveTab");
  }, []);

  const handleNotificationData = useCallback(
    (data: Record<string, unknown> | null) => {
      const id = data?.competitionId;
      if (typeof id === "string" && id.length > 0) void openCompetition(id);
    },
    [openCompetition],
  );

  const onNavigationReady = useCallback(() => {
    if (pendingCompetitionId.current) void openCompetition(pendingCompetitionId.current);
  }, [openCompetition]);

  // Bootstrap + push listeners
  useEffect(() => {
    hydrateTheme();
    initializeAuth();
    useCompetitionStore.getState().fetchCompetitions("initial");

    // App abierta desde una notificación con la app cerrada (cold start)
    if (!handledColdStart.current) {
      handledColdStart.current = true;
      getInitialNotificationData().then(handleNotificationData);
    }

    // Listeners de push (primer plano y tap). No-op en Expo Go.
    return addNotificationListeners({
      onReceived: (title, body) => {
        if (__DEV__) console.log("[PushNotification Received]:", title, body);
        // Una nueva competencia llega también por push: refrescar en silencio
        useCompetitionStore.getState().fetchCompetitions("silent");
      },
      onResponse: handleNotificationData,
    });
  }, []);

  // Tiempo real del listado + resincronización por ciclo de vida
  useEffect(() => {
    let resyncTimer: ReturnType<typeof setTimeout> | null = null;
    const scheduleResync = () => {
      if (resyncTimer) clearTimeout(resyncTimer);
      resyncTimer = setTimeout(() => {
        resyncTimer = null;
        useCompetitionStore.getState().fetchCompetitions("silent");
      }, RESYNC_DEBOUNCE_MS);
    };

    const disconnectGlobal = socketService.connectGlobal({
      onCompetitionCreated: (c) => {
        // Inserción inmediata (<2s) y luego hidratación completa (etapas, etc.)
        useCompetitionStore.getState().upsertCompetition(c);
        scheduleResync();
      },
      onCompetitionUpdated: (c) => useCompetitionStore.getState().upsertCompetition(c),
      // Eventos perdidos durante la desconexión
      onReconnect: scheduleResync,
    });

    let lastState: AppStateStatus = AppState.currentState;
    const sub = AppState.addEventListener("change", (next) => {
      if (/inactive|background/.test(lastState) && next === "active") {
        socketService.ensureGlobalConnected();
        useCompetitionStore.getState().fetchCompetitions("silent");
      }
      lastState = next;
    });

    return () => {
      if (resyncTimer) clearTimeout(resyncTimer);
      sub.remove();
      disconnectGlobal();
    };
  }, []);

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <StatusBar style={isDark ? "light" : "dark"} backgroundColor={colors.background} />
        <AppNavigator onReady={onNavigationReady} />
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
