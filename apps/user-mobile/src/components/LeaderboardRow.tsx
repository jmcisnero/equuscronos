import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { LeaderboardEntry } from "../types";
import { VetHeartRateBadge } from "./VetHeartRateBadge";
import { Theme, useTheme, useThemedStyles } from "../theme/useTheme";

interface LeaderboardRowProps {
  entry: LeaderboardEntry;
  onPress: (entry: LeaderboardEntry) => void;
  maxHeartRate?: number;
}

type BadgeTone = { bg: string; text: string };

/** Paleta de estados de carrera: [oscuro, claro] para mantener contraste AA. */
const STATUS_TONES: Record<string, { label: string; dark: BadgeTone; light: BadgeTone }> = {
  IN_RACE: {
    label: "EN PISTA",
    dark: { bg: "#065f46", text: "#6ee7b7" },
    light: { bg: "#D1FAE5", text: "#065F46" },
  },
  VET_CHECK: {
    label: "VET CHECK",
    dark: { bg: "#854d0e", text: "#fde047" },
    light: { bg: "#FEF3C7", text: "#92400E" },
  },
  RESTING: {
    label: "NEUTRALIZADO",
    dark: { bg: "#1e3a8a", text: "#93c5fd" },
    light: { bg: "#DBEAFE", text: "#1E40AF" },
  },
  FINISHED: {
    label: "FINALIZADO",
    dark: { bg: "#14532d", text: "#86efac" },
    light: { bg: "#DCFCE7", text: "#166534" },
  },
  DQ: {
    label: "DESCALIFICADO",
    dark: { bg: "#7f1d1d", text: "#fca5a5" },
    light: { bg: "#FEE2E2", text: "#991B1B" },
  },
  DNF: {
    label: "RETIRO / DNF",
    dark: { bg: "#451a03", text: "#fdba74" },
    light: { bg: "#FFEDD5", text: "#9A3412" },
  },
};

const STATUS_ALIASES: Record<string, string> = {
  FINISHED_PROVISIONAL: "FINISHED",
  ELIMINATED_GAIT: "DQ",
  ELIMINATED_TR: "DQ",
  WD: "DNF",
};

export const LeaderboardRow: React.FC<LeaderboardRowProps> = ({
  entry,
  onPress,
  maxHeartRate = 64,
}) => {
  const { isDark, colors } = useTheme();
  const styles = useThemedStyles(createStyles);

  const formatSpeed = (speed?: number) => {
    if (!speed || speed <= 0) return "--";
    return `${speed.toFixed(2)} km/h`;
  };

  const getStatusBadge = (status: string) => {
    const tone = STATUS_TONES[STATUS_ALIASES[status] ?? status];
    if (!tone) {
      return { label: status, bg: colors.surfaceMuted, text: colors.textStrong };
    }
    return { label: tone.label, ...(isDark ? tone.dark : tone.light) };
  };

  const statusBadge = getStatusBadge(entry.status);

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => onPress(entry)}
      activeOpacity={0.8}
    >
      <View style={styles.topRow}>
        <View style={styles.rankContainer}>
          <Text style={styles.rankText}>
            {entry.rank !== null ? `#${entry.rank}` : "-"}
          </Text>
        </View>

        <View style={styles.bibBadge}>
          <Text style={styles.bibText}>DORSAL {entry.bibNumber}</Text>
        </View>

        <View style={[styles.statusBadge, { backgroundColor: statusBadge.bg }]}>
          <Text style={[styles.statusText, { color: statusBadge.text }]}>
            {statusBadge.label}
          </Text>
        </View>
      </View>

      <View style={styles.mainInfo}>
        <View style={{ flex: 1 }}>
          <Text style={styles.riderName} numberOfLines={1}>
            {entry.riderName}
          </Text>
          <Text style={styles.horseName} numberOfLines={1}>
            🐴 {entry.horseName}
          </Text>
          {entry.representedTenant && (
            <Text style={styles.tenantName} numberOfLines={1}>
              🚩 {entry.representedTenant.name}
            </Text>
          )}
        </View>

        <View style={styles.rightStats}>
          <VetHeartRateBadge
            heartRate={entry.heartRate}
            maxHeartRate={maxHeartRate}
            isRecheck={entry.isRecheck}
            recheckStatus={entry.recheckStatus}
          />
        </View>
      </View>

      <View style={styles.footerMetrics}>
        <View style={styles.metricItem}>
          <Text style={styles.metricLabel}>Etapa Actual</Text>
          <Text style={styles.metricValue}>Etapa {entry.currentStage}</Text>
        </View>

        <View style={styles.metricItem}>
          <Text style={styles.metricLabel}>Velocidad Promedio</Text>
          <Text style={styles.metricValueHighlight}>
            {formatSpeed(entry.averageSpeed)}
          </Text>
        </View>

        <View style={styles.metricItem}>
          <Text style={styles.metricLabel}>Brecha</Text>
          <Text style={styles.metricValue}>
            {entry.gapToLeaderMs > 0
              ? `+${Math.round(entry.gapToLeaderMs / 1000)}s`
              : "LÍDER"}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const createStyles = ({ colors, cardShadow }: Theme) =>
  StyleSheet.create({
    card: {
      backgroundColor: colors.surface,
      borderRadius: 14,
      padding: 12,
      marginVertical: 6,
      marginHorizontal: 16,
      borderWidth: 1,
      borderColor: colors.border,
      ...cardShadow,
    },
    topRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 8,
    },
    rankContainer: {
      backgroundColor: colors.surfaceSunken,
      paddingHorizontal: 10,
      paddingVertical: 3,
      borderRadius: 8,
    },
    rankText: {
      color: colors.warning,
      fontWeight: "900",
      fontSize: 13,
    },
    bibBadge: {
      backgroundColor: colors.surfaceSunken,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 6,
    },
    bibText: {
      color: colors.textStrong,
      fontWeight: "800",
      fontSize: 10,
      letterSpacing: 0.5,
    },
    statusBadge: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 6,
    },
    statusText: {
      fontSize: 9,
      fontWeight: "800",
    },
    mainInfo: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 10,
    },
    riderName: {
      color: colors.text,
      fontSize: 15,
      fontWeight: "800",
    },
    horseName: {
      color: colors.textSecondary,
      fontSize: 12,
      fontWeight: "600",
      marginTop: 2,
    },
    tenantName: {
      color: colors.primary,
      fontSize: 10,
      fontWeight: "600",
      marginTop: 2,
    },
    rightStats: {
      alignItems: "flex-end",
    },
    footerMetrics: {
      flexDirection: "row",
      justifyContent: "space-between",
      backgroundColor: colors.surfaceSunken,
      padding: 8,
      borderRadius: 10,
      marginTop: 2,
    },
    metricItem: {
      alignItems: "center",
    },
    metricLabel: {
      color: colors.textMuted,
      fontSize: 9,
      fontWeight: "600",
    },
    metricValue: {
      color: colors.textStrong,
      fontSize: 11,
      fontWeight: "700",
      marginTop: 1,
    },
    metricValueHighlight: {
      color: colors.primary,
      fontSize: 11,
      fontWeight: "800",
      marginTop: 1,
    },
  });
