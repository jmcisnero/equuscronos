import React, { useEffect } from "react";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { addNotificationListeners } from "./src/services/notifications";
import { AppNavigator } from "./src/navigation/AppNavigator";
import { useAuthStore } from "./src/store/useAuthStore";
import { useCompetitionStore } from "./src/store/useCompetitionStore";
import { useTheme, useThemeStore } from "./src/theme/useTheme";

const queryClient = new QueryClient();

export default function App() {
  const { initializeAuth } = useAuthStore();
  const { fetchCompetitions } = useCompetitionStore();
  const { isDark, colors } = useTheme();
  const hydrateTheme = useThemeStore((s) => s.hydrate);

  useEffect(() => {
    // Inicializar autenticación y cargar competencias iniciales
    hydrateTheme();
    initializeAuth();
    fetchCompetitions();

    // Listeners de push (primer plano y tap). No-op en Expo Go.
    return addNotificationListeners({
      onReceived: (title, body) => console.log("[PushNotification Received]:", title, body),
      onResponse: (data) => console.log("[PushNotification Clicked] Payload data:", data),
    });
  }, []);

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <StatusBar style={isDark ? "light" : "dark"} backgroundColor={colors.background} />
        <AppNavigator />
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
