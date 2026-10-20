import React, { useMemo } from "react";
import {
  NavigationContainer,
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

const Tab = createBottomTabNavigator();

export const AppNavigator: React.FC = () => {
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
    <NavigationContainer theme={navTheme}>
      <Tab.Navigator
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarStyle: styles.tabBar,
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.tabInactive,
          tabBarLabelStyle: styles.tabBarLabel,
          tabBarIcon: ({ focused }) => {
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
        })}
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
      height: 60,
      paddingBottom: 8,
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
