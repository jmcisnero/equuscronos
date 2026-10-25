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
 * nombre, fecha DD/MM/AAAA, hora de largada, organizador/sede, distancia total,
 * desglose por etapas con neutralización (Art. 28/52) y límite Vet Gate (Art. 31).
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
        <Text style={styles.eyebrow}>SEGUIMIENTO EN VIVO</Text>
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
      <Text style={styles.eyebrow}>
        {isClosed ? "RESULTADOS FINALES" : "SEGUIMIENTO EN VIVO"}
      </Text>
      <Text style={styles.title} accessibilityRole="header">
        {competition.name}
      </Text>

      {/* Fecha y hora de largada */}
      <View style={styles.metaRow}>
        <View style={styles.metaItem}>
          <Text style={styles.metaLabel}>Fecha</Text>
          <Text style={styles.metaValue}>{formatDateDMY(competition.competitionDate)}</Text>
        </View>
        <View style={styles.metaItem}>
          <Text style={styles.metaLabel}>Largada</Text>
          <Text style={styles.metaValue}>{formatStartTime(competition.startTime)} hs</Text>
        </View>
        <View style={styles.metaItem}>
          <Text style={styles.metaLabel}>Distancia</Text>
          <Text style={styles.metaValue}>{totalKm > 0 ? formatKm(totalKm) : "--"}</Text>
        </View>
      </View>

      {/* Organizador / Sede */}
      <View style={styles.organizer}>
        {tenant?.jerseyImageUrl ? (
          <Image source={{ uri: tenant.jerseyImageUrl }} style={styles.jersey} />
        ) : (
          <View style={styles.jerseyFallback}>
            <Text style={styles.jerseyFallbackText}>
              {tenant?.name ? tenant.name.substring(0, 2).toUpperCase() : "EC"}
            </Text>
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Text style={styles.metaLabel}>Organizador</Text>
          <Text style={styles.organizerName} numberOfLines={1}>
            {tenant?.name || "Club no registrado"}
          </Text>
          {!!sede && (
            <Text style={styles.muted} numberOfLines={1}>
              📍 {sede}
            </Text>
          )}
        </View>
      </View>

      {/* Desglose de etapas (Art. 28 / 52) + Límite Vet Gate (Art. 31/54) en la misma fila */}
      <View style={styles.stages}>
        {stages.map((s, i) => (
          <View key={s.stageNumber} style={styles.stageChip}>
            <Text style={styles.stageTitle}>Etapa {s.stageNumber}</Text>
            <Text style={styles.stageKm}>{formatKm(s.distanceKm)}</Text>
            {i < stages.length - 1 && s.neutralizationMinutes > 0 && (
              <Text style={styles.stageNeut}>Neut. {s.neutralizationMinutes} min</Text>
            )}
          </View>
        ))}
        <View
          style={styles.stageChip}
          accessible
          accessibilityLabel={`Límite Vet Gate: hasta ${maxHeartRate} pulsaciones por minuto`}
        >
          <Text style={styles.stageTitle}>Límite ppm</Text>
          <View style={styles.vetHeader}>
            <Text style={styles.vetHeart} allowFontScaling={false}>♥</Text>
            <Text style={styles.stageKm} numberOfLines={1}>
              ≤ {maxHeartRate}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
};

const createStyles = ({ colors, cardShadow, isDark }: Theme) => {
  // Tono verde de contraste para separar el resumen de la lista de binomios
  const summaryBg = colors.summarySurface;
  const summaryBorder = colors.summaryBorder;
  const innerBg = colors.summaryInner;
  const innerBorder = colors.summaryInnerBorder;

  return StyleSheet.create({
    card: {
      backgroundColor: summaryBg,
      borderRadius: 18,
      padding: 16,
      marginHorizontal: 16,
      marginTop: 12,
      marginBottom: 8,
      borderWidth: 1,
      borderColor: summaryBorder,
      gap: 12,
      ...cardShadow,
    },
    eyebrow: { color: colors.primary, fontSize: 10, fontWeight: "900", letterSpacing: 1 },
    title: { color: colors.text, fontSize: 20, fontWeight: "900", lineHeight: 25, marginTop: -6 },
    muted: { color: colors.textSecondary, fontSize: 12, marginTop: 1 },
    metaRow: {
      flexDirection: "row",
      backgroundColor: innerBg,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: innerBorder,
      paddingVertical: 10,
    },
    metaItem: { flex: 1, alignItems: "center" },
    metaLabel: {
      color: colors.textMuted,
      fontSize: 9,
      fontWeight: "800",
      textTransform: "uppercase",
      letterSpacing: 0.6,
    },
    metaValue: {
      color: colors.text,
      fontSize: 15,
      fontWeight: "800",
      fontVariant: ["tabular-nums"],
      marginTop: 2,
    },
    organizer: { flexDirection: "row", alignItems: "center", gap: 10 },
    jersey: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: colors.border },
    jerseyFallback: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.surfaceMuted,
      alignItems: "center",
      justifyContent: "center",
    },
    jerseyFallbackText: { color: colors.textStrong, fontWeight: "900", fontSize: 12 },
    organizerName: { color: colors.text, fontSize: 14, fontWeight: "800" },
    stages: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    stageChip: {
      flexGrow: 1,
      flexBasis: "30%",
      minWidth: 0,
      backgroundColor: innerBg,
      borderRadius: 10,
      paddingHorizontal: 10,
      paddingVertical: 7,
      borderWidth: 1,
      borderColor: innerBorder,
    },
    stageTitle: { color: colors.textMuted, fontSize: 9, fontWeight: "900", textTransform: "uppercase" },
    stageKm: { color: colors.text, fontSize: 15, fontWeight: "900", fontVariant: ["tabular-nums"] },
    stageNeut: { color: colors.warning, fontSize: 10, fontWeight: "700", marginTop: 1 },
    vetHeader: { flexDirection: "row", alignItems: "center", gap: 4 },
    vetHeart: { color: getRaceTones(isDark).heartOk, fontSize: 14 },
  });
};
