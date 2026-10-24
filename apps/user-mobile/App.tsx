import React, { useEffect } from "react";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import * as Notifications from "expo-notifications";
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

    // Listener para notificaciones push en primer plano (Foreground)
    const notificationSubscription = Notifications.addNotificationReceivedListener(
      (notification) => {
        console.log(
          "[PushNotification Received]:",
          notification.request.content.title,
          notification.request.content.body,
        );
      },
    );

    // Listener para cuando el usuario presiona una notificación push (Tap action)
    const responseSubscription = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const data = response.notification.request.content.data;
        console.log("[PushNotification Clicked] Payload data:", data);
      },
    );

    return () => {
      notificationSubscription.remove();
      responseSubscription.remove();
    };
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
