import React from "react";
import { View, Text, StyleSheet, Image } from "react-native";
import { Competition } from "../../types";
import { Theme, useThemedStyles } from "../../theme/useTheme";
import { getRaceTones } from "../../theme/raceTones";
import {
  formatDateDMY,
  formatKm,
  formatStartTime,
  getStagePlan,
} from "../../utils/raceFormat";

interface RaceSummaryCardProps {
  competition: Competition | null;
  maxHeartRate: number;
  isClosed: boolean;
}

/**
 * Bloque de resumen del Raid (equivalente al hero de leaderboard/[id]/page.tsx):
 * Versión compacta optimizada para pantallas móviles.
 */
export const RaceSummaryCard: React.FC<RaceSummaryCardProps> = ({
  competition,
  maxHeartRate,
  isClosed,
}) => {
  const styles = useThemedStyles(createStyles);

  if (!competition) {
    return (
      <View style={styles.card}>
        <Text style={styles.title}>Selecciona una competencia</Text>
        <Text style={styles.muted}>Elige una prueba en la pestaña Explorar.</Text>
      </View>
    );
  }

  const { stages, totalKm } = getStagePlan(competition);
  const tenant = competition.tenant;
  const sede = competition.location || tenant?.location;

  return (
    <View style={styles.card}>
      {/* Cuadrante 1: Título y Estado */}
      <View style={styles.titleRow}>
        <Text style={styles.title} numberOfLines={2} accessibilityRole="header">
          {competition.name}
        </Text>
      </View>

      {/* Cuadrante 2: Fila Resumen: Fecha, Largada, Distancia */}
      <View style={styles.metaRow}>
        <View style={styles.metaItem}>
          <Text style={styles.metaLabel}>Fecha</Text>
          <Text style={styles.metaValue}>{formatDateDMY(competition.competitionDate)}</Text>
        </View>
        <View style={[styles.metaItem, styles.metaItemBorder]}>
          <Text style={styles.metaLabel}>Largada</Text>
          <Text style={styles.metaValue}>{formatStartTime(competition.startTime)} hs</Text>
        </View>
        <View style={[styles.metaItem, styles.metaItemBorder]}>
          <Text style={styles.metaLabel}>Distancia</Text>
          <Text style={styles.metaValue}>{totalKm > 0 ? formatKm(totalKm) : "--"}</Text>
        </View>
      </View>

      {/* Cuadrante 3: Información del Club Organizador */}
      <View style={styles.organizerRow}>
        {tenant?.jerseyImageUrl ? (
          <Image source={{ uri: tenant.jerseyImageUrl }} style={styles.jersey} />
        ) : (
          <View style={styles.jerseyFallback}>
            <Text style={styles.jerseyFallbackText}>
              {tenant?.name ? tenant.name.substring(0, 2).toUpperCase() : "EC"}
            </Text>
          </View>
        )}
        <View style={styles.organizerTextCol}>
          <Text style={styles.organizerName} numberOfLines={1}>
            {tenant?.name || "Club no registrado"}
          </Text>
          {!!sede && (
            <Text style={styles.sedeText} numberOfLines={1}>
              📍 {sede}
            </Text>
          )}
        </View>
      </View>

      {/* Cuadrante 4: Tarjetas de Etapas y Parámetros FEU */}
      <View style={styles.stagesRow}>
        {stages.map((s, i) => (
          <View key={s.stageNumber} style={styles.stageChip}>
            <View style={styles.stageContent}>
              <Text style={styles.stageKmText}>
                E{s.stageNumber} - {formatKm(s.distanceKm)}
              </Text>
              {i < stages.length - 1 && s.neutralizationMinutes > 0 && (
                <Text style={styles.stageNeutText}>
                  Neut. {s.neutralizationMinutes} min
                </Text>
              )}
            </View>
          </View>
        ))}
        <View
          style={styles.stageChip}
          accessible
          accessibilityLabel={`Límite Vet Gate: hasta ${maxHeartRate} pulsaciones por minuto`}
        >
          <View style={styles.stageContent}>
            <Text style={styles.stageTitleText}>LÍMITE PPM</Text>
            <View style={styles.vetValueRow}>
              <Text style={styles.vetHeart} allowFontScaling={false}>
                ❤️
              </Text>
              <Text style={styles.vetLimitText}>≤ {maxHeartRate}</Text>
            </View>
          </View>
        </View>
      </View>
    </View>
  );
};

const createStyles = ({ colors, cardShadow, isDark }: Theme) => {
  const summaryBg = colors.summarySurface;
  const summaryBorder = colors.summaryBorder;
  const innerBg = colors.summaryInner;
  const innerBorder = colors.summaryInnerBorder;

  return StyleSheet.create({
    card: {
      backgroundColor: summaryBg,
      borderRadius: 16,
      paddingHorizontal: 12,
      paddingVertical: 10,
      marginHorizontal: 16,
      marginTop: 8,
      marginBottom: 6,
      borderWidth: 1,
      borderColor: summaryBorder,
      gap: 7,
      ...cardShadow,
    },
    titleRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    title: {
      flex: 1,
      color: colors.text,
      fontSize: 16,
      fontWeight: "900",
      lineHeight: 20,
    },
    muted: { color: colors.textSecondary, fontSize: 11, marginTop: 1 },

    // Cuadrante 2: Fila Resumen
    metaRow: {
      flexDirection: "row",
      backgroundColor: innerBg,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: innerBorder,
      paddingVertical: 5,
    },
    metaItem: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
    },
    metaItemBorder: {
      borderLeftWidth: 1,
      borderLeftColor: innerBorder,
    },
    metaLabel: {
      color: colors.textMuted,
      fontSize: 8.5,
      fontWeight: "800",
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
    metaValue: {
      color: colors.text,
      fontSize: 13,
      fontWeight: "900",
      fontVariant: ["tabular-nums"],
      marginTop: 1,
    },

    // Cuadrante 3: Organizador
    organizerRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 4,
      paddingVertical: 2,
      gap: 10,
    },
    jersey: {
      width: 32,
      height: 32,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
    },
    jerseyFallback: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: colors.surfaceMuted,
      alignItems: "center",
      justifyContent: "center",
    },
    jerseyFallbackText: {
      color: colors.textStrong,
      fontWeight: "900",
      fontSize: 11,
    },
    organizerTextCol: {
      flex: 1,
      justifyContent: "center",
    },
    organizerName: {
      color: colors.text,
      fontSize: 13,
      fontWeight: "800",
      lineHeight: 16,
    },
    sedeText: {
      color: colors.textSecondary,
      fontSize: 11,
      fontWeight: "600",
      lineHeight: 15,
      marginTop: 1,
    },

    // Cuadrante 4: Etapas y Límite PPM
    stagesRow: {
      flexDirection: "row",
      gap: 6,
    },
    stageChip: {
      flex: 1,
      backgroundColor: innerBg,
      borderRadius: 8,
      paddingHorizontal: 6,
      paddingVertical: 4.5,
      borderWidth: 1,
      borderColor: innerBorder,
      justifyContent: "center",
      alignItems: "center",
      minHeight: 38,
    },
    stageContent: {
      alignItems: "center",
      justifyContent: "center",
    },
    stageKmText: {
      color: colors.text,
      fontSize: 11.5,
      fontWeight: "900",
      fontVariant: ["tabular-nums"],
    },
    stageNeutText: {
      color: colors.warning,
      fontSize: 8.5,
      fontWeight: "800",
      marginTop: 0.5,
    },
    stageTitleText: {
      color: colors.textMuted,
      fontSize: 8,
      fontWeight: "900",
      textTransform: "uppercase",
      letterSpacing: 0.4,
    },
    vetValueRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 3,
      marginTop: 1,
    },
    vetHeart: {
      fontSize: 9,
    },
    vetLimitText: {
      color: colors.text,
      fontSize: 11.5,
      fontWeight: "900",
      fontVariant: ["tabular-nums"],
    },
  });
};
