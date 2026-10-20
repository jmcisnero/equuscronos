import { useMemo } from "react";
import { useColorScheme, ViewStyle } from "react-native";
import { create } from "zustand";
import * as SecureStore from "expo-secure-store";
import { darkColors, lightColors, ThemeColors } from "./palettes";

export type ThemePreference = "system" | "light" | "dark";
export type ColorScheme = "light" | "dark";

const STORAGE_KEY = "equuscronos.themePreference";

interface ThemeState {
  preference: ThemePreference;
  hydrated: boolean;
  setPreference: (pref: ThemePreference) => void;
  hydrate: () => Promise<void>;
}

export const useThemeStore = create<ThemeState>((set) => ({
  preference: "system",
  hydrated: false,
  setPreference: (preference) => {
    set({ preference });
    SecureStore.setItemAsync(STORAGE_KEY, preference).catch(() => undefined);
  },
  hydrate: async () => {
    try {
      const stored = await SecureStore.getItemAsync(STORAGE_KEY);
      if (stored === "light" || stored === "dark" || stored === "system") {
        set({ preference: stored });
      }
    } finally {
      set({ hydrated: true });
    }
  },
}));

export interface Theme {
  scheme: ColorScheme;
  isDark: boolean;
  preference: ThemePreference;
  colors: ThemeColors;
  /** Sombra sutil para tarjetas (solo tiene efecto en modo claro) */
  cardShadow: ViewStyle;
  setPreference: (pref: ThemePreference) => void;
}

export function useTheme(): Theme {
  const systemScheme = useColorScheme();
  const preference = useThemeStore((s) => s.preference);
  const setPreference = useThemeStore((s) => s.setPreference);

  const scheme: ColorScheme =
    preference === "system" ? (systemScheme === "light" ? "light" : "dark") : preference;

  return useMemo(() => {
    const isDark = scheme === "dark";
    const colors = isDark ? darkColors : lightColors;
    const cardShadow: ViewStyle = isDark
      ? {}
      : {
          shadowColor: colors.shadow,
          shadowOpacity: 0.06,
          shadowRadius: 8,
          shadowOffset: { width: 0, height: 2 },
          elevation: 2,
        };
    return { scheme, isDark, preference, colors, cardShadow, setPreference };
  }, [scheme, preference, setPreference]);
}

/** Crea estilos memoizados que se regeneran al cambiar de tema. */
export function useThemedStyles<T>(factory: (theme: Theme) => T): T {
  const theme = useTheme();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => factory(theme), [theme]);
}
