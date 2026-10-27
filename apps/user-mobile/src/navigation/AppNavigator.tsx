import React, { useMemo } from "react";
import {
  NavigationContainer,
  createNavigationContainerRef,
  DarkTheme as NavDarkTheme,
  DefaultTheme as NavLightTheme,
  Theme as NavigationTheme,
} from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Text, View, StyleSheet } from "react-native";

import { ExplorerScreen } from "../screens/ExplorerScreen";
import { LiveLeaderboardScreen } from "../screens/LiveLeaderboardScreen";
import { NotificationSettingsScreen } from "../screens/NotificationSettingsScreen";
import { ProfileScreen } from "../screens/ProfileScreen";
import { Theme, useTheme, useThemedStyles } from "../theme/useTheme";

export type RootTabParamList = {
  ExplorerTab: undefined;
  LiveTab: undefined;
  NotificationsTab: undefined;
  ProfileTab: undefined;
  ResultsTab: undefined;
};

/** Ref global para navegar desde fuera del árbol (p. ej. tap en push). */
export const navigationRef = createNavigationContainerRef<RootTabParamList>();

const Tab = createBottomTabNavigator<RootTabParamList>();

/** Consulta histórica: misma pantalla de clasificación, sin tiempo real. */
const ResultsScreen: React.FC<{ navigation: any }> = (props) => (
  <LiveLeaderboardScreen {...props} mode="results" />
);

export const AppNavigator: React.FC<{ onReady?: () => void }> = ({ onReady }) => {
  const { isDark, colors } = useTheme();
  const styles = useThemedStyles(createStyles);

  // Sincroniza el tema de React Navigation para evitar flashes de fondo
  // blanco/negro durante transiciones al alternar el modo.
  const navTheme: NavigationTheme = useMemo(() => {
    const base = isDark ? NavDarkTheme : NavLightTheme;
    return {
      ...base,
      dark: isDark,
      colors: {
        ...base.colors,
        primary: colors.primary,
        background: colors.background,
        card: isDark ? colors.background : colors.surface,
        text: colors.text,
        border: colors.border,
        notification: colors.danger,
      },
    };
  }, [isDark, colors]);

  return (
    <NavigationContainer ref={navigationRef} theme={navTheme} onReady={onReady}>
      <Tab.Navigator
        backBehavior="history"
        screenOptions={({ route, navigation }) => {
          // ResultsTab es una ruta oculta hija del flujo "Explorar": mientras
          // está enfocada, el tab "Explorar" conserva el resaltado visual.
          const state = navigation.getState();
          const current = state?.routes?.[state.index]?.name;
          const explorerContext = route.name === "ExplorerTab" && current === "ResultsTab";
          return {
          headerShown: false,
          tabBarStyle: styles.tabBar,
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: explorerContext ? colors.primary : colors.tabInactive,
          tabBarLabelStyle: styles.tabBarLabel,
          tabBarIcon: ({ focused: isRouteFocused }) => {
            const focused = isRouteFocused || explorerContext;
            let icon = "🏆";
            if (route.name === "ExplorerTab") icon = "🏆";
            if (route.name === "LiveTab") icon = "⏱️";
            if (route.name === "NotificationsTab") icon = "🔔";
            if (route.name === "ProfileTab") icon = "👤";

            return (
              <View style={[styles.iconContainer, focused && styles.activeIconBg]}>
                <Text style={[styles.iconText, !focused && styles.inactiveIcon]}>{icon}</Text>
              </View>
            );
          },
          };
        }}
      >
        <Tab.Screen
          name="ExplorerTab"
          component={ExplorerScreen}
          options={{ title: "Explorar" }}
        />
        <Tab.Screen
          name="LiveTab"
          component={LiveLeaderboardScreen}
          options={{ title: "En Vivo" }}
        />
        <Tab.Screen
          name="NotificationsTab"
          component={NotificationSettingsScreen}
          options={{ title: "Alertas" }}
        />
        <Tab.Screen
          name="ProfileTab"
          component={ProfileScreen}
          options={{ title: "Perfil" }}
        />
        <Tab.Screen
          name="ResultsTab"
          component={ResultsScreen}
          options={{
            title: "Resultados Finales",
            tabBarButton: () => null,
            tabBarItemStyle: { display: "none" },
          }}
        />
      </Tab.Navigator>
    </NavigationContainer>
  );
};

const createStyles = ({ colors, isDark }: Theme) =>
  StyleSheet.create({
    tabBar: {
      backgroundColor: isDark ? colors.background : colors.surface,
      borderTopColor: colors.divider,
      borderTopWidth: 1,
      paddingTop: 6,
    },
    tabBarLabel: {
      fontSize: 10,
      fontWeight: "700",
    },
    iconContainer: {
      padding: 3,
      borderRadius: 8,
    },
    activeIconBg: {
      backgroundColor: colors.primarySoft,
    },
    iconText: {
      fontSize: 16,
    },
    inactiveIcon: {
      opacity: 0.6,
    },
  });
