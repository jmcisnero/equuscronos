/**
 * Tokens semánticos de color. Los componentes NUNCA deben usar hex directos:
 * siempre consumen estos tokens vía useTheme() para soportar modo claro/oscuro.
 */
export interface ThemeColors {
  /** Fondo general de pantalla */
  background: string;
  /** Tarjetas y superficies elevadas */
  surface: string;
  /** Superficie hundida dentro de una tarjeta (métricas, grids) */
  surfaceSunken: string;
  /** Chips, botones secundarios, fallback de avatar */
  surfaceMuted: string;
  /** Superficie con selección activa */
  surfaceSelected: string;
  border: string;
  divider: string;

  /** Tarjeta de resumen de carrera (tono verde de contraste) */
  summarySurface: string;
  summaryBorder: string;
  /** Bloques internos de la tarjeta de resumen (metadatos, etapas) */
  summaryInner: string;
  summaryInnerBorder: string;

  text: string;
  textStrong: string;
  textSecondary: string;
  textMuted: string;

  primary: string;
  primaryStrong: string;
  primarySoft: string;
  primaryBorder: string;
  onPrimary: string;

  warning: string;
  warningSoft: string;
  warningBorder: string;
  danger: string;
  dangerSoft: string;
  dangerBorder: string;
  neutralSoft: string;
  neutralBorder: string;
  info: string;

  overlay: string;
  switchTrackOff: string;
  switchThumbOff: string;
  tabInactive: string;
  /** Color de sombra (solo visible en modo claro) */
  shadow: string;
}

export const darkColors: ThemeColors = {
  background: "#0f172a",
  surface: "#1e293b",
  surfaceSunken: "#0f172a",
  surfaceMuted: "#334155",
  surfaceSelected: "#0f2922",
  border: "#334155",
  divider: "#1e293b",

  summarySurface: "#0F291E",
  summaryBorder: "rgba(16, 185, 129, 0.25)",
  summaryInner: "rgba(15, 23, 42, 0.55)",
  summaryInnerBorder: "rgba(16, 185, 129, 0.18)",

  text: "#ffffff",
  textStrong: "#e2e8f0",
  textSecondary: "#94a3b8",
  textMuted: "#64748b",

  primary: "#10b981",
  primaryStrong: "#059669",
  primarySoft: "rgba(16, 185, 129, 0.15)",
  primaryBorder: "rgba(16, 185, 129, 0.4)",
  onPrimary: "#ffffff",

  warning: "#f59e0b",
  warningSoft: "rgba(245, 158, 11, 0.15)",
  warningBorder: "rgba(245, 158, 11, 0.4)",
  danger: "#ef4444",
  dangerSoft: "rgba(239, 68, 68, 0.15)",
  dangerBorder: "rgba(239, 68, 68, 0.4)",
  neutralSoft: "rgba(100, 116, 139, 0.2)",
  neutralBorder: "rgba(100, 116, 139, 0.4)",
  info: "#3b82f6",

  overlay: "rgba(15, 23, 42, 0.85)",
  switchTrackOff: "#334155",
  switchThumbOff: "#94a3b8",
  tabInactive: "#64748b",
  shadow: "transparent",
};

export const lightColors: ThemeColors = {
  background: "#F8FAFC",
  surface: "#FFFFFF",
  surfaceSunken: "#F1F5F9",
  surfaceMuted: "#E2E8F0",
  surfaceSelected: "#ECFDF5",
  border: "#E2E8F0",
  divider: "#E2E8F0",

  summarySurface: "#F0FDF4",
  summaryBorder: "#BBF7D0",
  summaryInner: "#FFFFFF",
  summaryInnerBorder: "#DCFCE7",

  text: "#0F172A",
  textStrong: "#1E293B",
  textSecondary: "#475569",
  textMuted: "#64748B",

  primary: "#059669",
  primaryStrong: "#047857",
  primarySoft: "rgba(5, 150, 105, 0.10)",
  primaryBorder: "rgba(5, 150, 105, 0.35)",
  onPrimary: "#ffffff",

  warning: "#B45309",
  warningSoft: "rgba(217, 119, 6, 0.10)",
  warningBorder: "rgba(217, 119, 6, 0.35)",
  danger: "#DC2626",
  dangerSoft: "rgba(220, 38, 38, 0.08)",
  dangerBorder: "rgba(220, 38, 38, 0.3)",
  neutralSoft: "rgba(100, 116, 139, 0.12)",
  neutralBorder: "rgba(100, 116, 139, 0.3)",
  info: "#2563EB",

  overlay: "rgba(15, 23, 42, 0.45)",
  switchTrackOff: "#CBD5E1",
  switchThumbOff: "#F8FAFC",
  tabInactive: "#94A3B8",
  shadow: "#0F172A",
};
