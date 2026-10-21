import React, { useMemo } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Image } from "react-native";
import { LeaderboardEntry } from "../types";
import { Theme, useTheme, useThemedStyles } from "../theme/useTheme";
import { getRaceTones } from "../theme/raceTones";
import { HeartPulseBadge } from "./race/HeartPulseBadge";
import { RaceStatusBadge } from "./race/RaceStatusBadge";
import {
  formatGap,
  formatHHMMSS,
  formatSpeed,
  formatTime,
  isTerminalStatus,
} from "../utils/raceFormat";

interface LeaderboardRowProps {
  entry: LeaderboardEntry;
  onPress: (entry: LeaderboardEntry) => void;
  maxHeartRate: number;
  /** Competencia cerrada: muestra pulso de Etapa 1 (base del Trofeo Art. 42) */
  isClosed?: boolean;
  isTrophyWinner?: boolean;
  /** Modalidad con chips RFID: muestra el límite de ingreso a Vet Gate */
  isRfidMode?: boolean;
}

/**
 * Tarjeta de binomio. Estructura idéntica a la vista móvil de
 * public-web/LeaderboardTable.tsx: rango, camiseta + dorsal, estado,
 * jinete/caballo/club, grilla de métricas y pulso en Vet Gate.
 */
const LeaderboardRowBase: React.FC<LeaderboardRowProps> = ({
  entry,
  onPress,
  maxHeartRate,
  isClosed = false,
  isTrophyWinner = false,
  isRfidMode = false,
}) => {
  const { isDark } = useTheme();
  const tones = useMemo(() => getRaceTones(isDark), [isDark]);
  const styles = useThemedStyles(createStyles);

  const isOut = isTerminalStatus(entry.status);
  const showRank = !!entry.rank && !isOut;
  const podium =
    entry.rank === 1 || entry.rank === 2 || entry.rank === 3
      ? tones.podium[entry.rank]
      : tones.podium.other;
  const gap = formatGap(entry.gapToLeaderMs, entry.totalRaceTimeMs);

  // En resultados finales la web muestra el pulso de Etapa 1 (criterio del Trofeo)
  const pulseSource = isClosed
    ? entry.stages?.find((s) => s.stageNumber === 1)
    : undefined;
  const pulse = isClosed ? pulseSource?.heartRate : entry.heartRate;
  const tenant = entry.representedTenant;

  return (
    <TouchableOpacity
      style={[styles.card, isOut && styles.cardOut]}
      onPress={() => onPress(entry)}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel={`Posición ${showRank ? entry.rank : "sin clasificar"}, dorsal ${entry.bibNumber}, ${entry.riderName} con ${entry.horseName}`}
      accessibilityHint="Abre el historial de etapas"
    >
      {/* Cabecera: rango · camiseta + dorsal · estado */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          {showRank ? (
            <View
              style={[styles.rank, { backgroundColor: podium.bg, borderColor: podium.border }]}
            >
              <Text style={[styles.rankText, { color: podium.text }]}>{entry.rank}</Text>
            </View>
          ) : (
            <View style={styles.rankEmpty}>
              <Text style={styles.rankEmptyText}>--</Text>
            </View>
          )}

          {tenant?.jerseyImageUrl ? (
            <Image source={{ uri: tenant.jerseyImageUrl }} style={styles.jersey} />
          ) : null}

          <View style={[styles.bib, { backgroundColor: tones.bibBg }]}>
            <Text style={[styles.bibText, { color: tones.bibText }]}>#{entry.bibNumber}</Text>
          </View>
        </View>
        <RaceStatusBadge status={entry.status} />
      </View>

      {/* Binomio y club */}
      <View style={styles.identity}>
        <Text style={styles.rider} numberOfLines={1}>
          {entry.riderName}
        </Text>
        <Text style={styles.horse} numberOfLines={1}>
          Caballo: {entry.horseName}
        </Text>
        {!!tenant?.name && (
          <Text style={styles.club} numberOfLines={1}>
            🚩 {tenant.name}
          </Text>
        )}
      </View>

      {/* Grilla de métricas técnicas */}
      <View style={styles.grid}>
        <Metric label="Etapa" value={`Etapa ${entry.currentStage}`} styles={styles} />
        <Metric label="Tiempo Neto" value={formatTime(entry.totalRaceTimeMs)} styles={styles} strong />
        <Metric
          label="Diferencia"
          value={gap.text}
          styles={styles}
          color={gap.isLeader ? tones.accent : undefined}
          strong
        />
        <Metric label="Velocidad Promedio" value={formatSpeed(entry.averageSpeed)} styles={styles} />
        {!!entry.startTime && (
          <Metric
            label="Hora Salida"
            value={formatHHMMSS(entry.startTime)}
            styles={styles}
            color={tones.timeAccent}
            strong
          />
        )}
        {!!entry.arrivalTime && (
          <Metric
            label="Hora Llegada"
            value={formatHHMMSS(entry.arrivalTime)}
            styles={styles}
            color={tones.timeAccent}
            strong
          />
        )}
        {!!entry.vetInTime && (
          <Metric label="Toma de Pulso" value={formatHHMMSS(entry.vetInTime)} styles={styles} />
        )}
        {isRfidMode && !!entry.nextVetControlTime && !isClosed && (
          <Metric
            label="Límite Vet Gate"
            value={formatHHMMSS(entry.nextVetControlTime)}
            styles={styles}
            color={tones.accent}
            strong
          />
        )}
      </View>

      {/* Pulso en control veterinario */}
      {(pulse || entry.isRecheck || isTrophyWinner) && (
        <View style={styles.pulseRow}>
          <Text style={styles.metricLabel}>
            {isClosed ? "Pulso Etapa 1 (Art. 42)" : "Pulso Control Veterinario"}
          </Text>
          <HeartPulseBadge
            pulse={pulse}
            maxHeartRate={maxHeartRate}
            isTrophyWinner={isTrophyWinner}
            isRecheck={isClosed ? pulseSource?.isRecheck ?? entry.isRecheck : entry.isRecheck}
            recheckStatus={isClosed ? pulseSource?.recheckStatus ?? entry.recheckStatus : entry.recheckStatus}
          />
        </View>
      )}
      {isTrophyWinner && (
        <Text style={[styles.trophyNote, { color: tones.trophy }]}>
          🏆 Trofeo al Menor Pulso (Art. 42)
        </Text>
      )}
    </TouchableOpacity>
  );
};

const Metric: React.FC<{
  label: string;
  value: string;
  styles: ReturnType<typeof createStyles>;
  color?: string;
  strong?: boolean;
}> = ({ label, value, styles, color, strong }) => (
  <View style={styles.metric}>
    <Text style={styles.metricLabel}>{label}</Text>
    <Text style={[styles.metricValue, strong && styles.metricStrong, color ? { color } : null]}>
      {value}
    </Text>
  </View>
);

/** Memoizado: el feed en vivo re-emite la lista completa en cada tick de socket. */
export const LeaderboardRow = React.memo(LeaderboardRowBase);

const createStyles = ({ colors, cardShadow, isDark }: Theme) =>
  StyleSheet.create({
    card: {
      backgroundColor: colors.surface,
      borderRadius: 20,
      padding: 14,
      marginVertical: 6,
      marginHorizontal: 16,
      borderWidth: 1,
      borderColor: colors.border,
      gap: 12,
      ...cardShadow,
    },
    cardOut: {
      backgroundColor: isDark ? "rgba(244,63,94,0.06)" : "#FFF8F9",
    },
    header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    headerLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
    rank: {
      width: 34,
      height: 34,
      borderRadius: 17,
      borderWidth: 1,
      alignItems: "center",
      justifyContent: "center",
    },
    rankText: { fontSize: 14, fontWeight: "900", fontVariant: ["tabular-nums"] },
    rankEmpty: { width: 34, height: 34, alignItems: "center", justifyContent: "center" },
    rankEmptyText: { color: colors.textMuted, fontWeight: "800", fontSize: 14 },
    jersey: { width: 26, height: 26, borderRadius: 13, borderWidth: 1, borderColor: colors.border },
    bib: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 8 },
    bibText: { fontSize: 13, fontWeight: "900", fontVariant: ["tabular-nums"] },
    identity: { gap: 2 },
    rider: { color: colors.text, fontSize: 17, fontWeight: "900" },
    horse: { color: colors.textSecondary, fontSize: 13, fontWeight: "700" },
    club: { color: colors.primary, fontSize: 12, fontWeight: "700" },
    grid: {
      flexDirection: "row",
      flexWrap: "wrap",
      borderTopWidth: 1,
      borderTopColor: colors.border,
      paddingTop: 10,
      rowGap: 10,
    },
    metric: { width: "50%" },
    metricLabel: {
      color: colors.textMuted,
      fontSize: 9,
      fontWeight: "800",
      textTransform: "uppercase",
      letterSpacing: 0.6,
    },
    metricValue: {
      color: colors.textStrong,
      fontSize: 14,
      fontWeight: "600",
      fontVariant: ["tabular-nums"],
      marginTop: 2,
    },
    metricStrong: { color: colors.text, fontWeight: "800" },
    pulseRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      borderTopWidth: 1,
      borderTopColor: colors.border,
      borderStyle: "dashed",
      paddingTop: 8,
    },
    trophyNote: { fontSize: 11, fontWeight: "800", marginTop: -6 },
  });
