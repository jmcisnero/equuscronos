import React, { useMemo } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Image } from "react-native";
import { LeaderboardEntry } from "../types";
import { Theme, useTheme, useThemedStyles } from "../theme/useTheme";
import { getRaceTones } from "../theme/raceTones";
import { HeartPulseBadge } from "./race/HeartPulseBadge";
import { RaceStatusBadge } from "./race/RaceStatusBadge";
import {
  formatGap,
  formatGapHMS,
  formatHHMMSS,
  formatSpeed,
  formatTime,
  getDisplayPulse,
  isTerminalStatus,
} from "../utils/raceFormat";

interface LeaderboardRowProps {
  entry: LeaderboardEntry;
  onPress: (entry: LeaderboardEntry) => void;
  maxHeartRate: number;
  /** Competencia finalizada (COMPLETED / OFFICIAL): vista de totales consolidados */
  isClosed?: boolean;
  isTrophyWinner?: boolean;
  /** Modalidad con chips RFID: muestra el límite de ingreso a Vet Gate */
  isRfidMode?: boolean;
  /** Raid FEU: desde la Etapa 2 se muestra el pulso de la neutralización de Etapa 1 */
  isFeuRaid?: boolean;
}

/** Texto de progresión en vivo según el estado del binomio. */
function getLiveProgress(entry: LeaderboardEntry): { icon: string; text: string } | null {
  switch (entry.status) {
    case "IN_RACE":
      return entry.startTime
        ? { icon: "🏇", text: `En ruta · salió ${formatHHMMSS(entry.startTime)}` }
        : { icon: "🏇", text: "En ruta" };
    case "VET_CHECK":
      return entry.vetInTime
        ? { icon: "🩺", text: `Toma de Pulso ${formatHHMMSS(entry.vetInTime)}` }
        : { icon: "🩺", text: "Toma de Pulso" };
    case "RESTING":
      return entry.nextStageDepartureTime
        ? { icon: "⏱️", text: `Neutralización · larga ${formatHHMMSS(entry.nextStageDepartureTime)}` }
        : { icon: "⏱️", text: "Cumpliendo neutralización" };
    case "FINISHED_PROVISIONAL":
      return { icon: "🏁", text: "Arribó a meta · resultado provisional" };
    case "FINISHED":
      return { icon: "🏁", text: "Completó la prueba" };
    default:
      return null;
  }
}

const NO_TIME = "--:--:--";

/**
 * Hora de llegada a la etapa en disputa. Prioriza el desglose por etapa; en
 * Vet Gate el binomio ya arribó a la etapa actual, por lo que `arrivalTime`
 * es un respaldo válido. Sin registro: "--:--:--".
 */
function getCurrentStageArrival(entry: LeaderboardEntry): string {
  const stageArrival = entry.stages?.find((s) => s.stageNumber === entry.currentStage)?.arrivalTime;
  const fallback = entry.status === "VET_CHECK" ? entry.arrivalTime : undefined;
  const value = stageArrival || fallback;
  return value ? formatHHMMSS(value).replace(/^--$/, NO_TIME) : NO_TIME;
}

/**
 * Tarjeta de binomio. Dos modos, alineados con public-web:
 *  - En curso (LeaderboardTable): llegada a la etapa en disputa, progresión,
 *    tiempo neto, diferencia y velocidad. El club se muestra solo en el detalle.
 *  - Finalizada (FinalResultsTable): puesto, tiempo total, velocidad media y
 *    pulso de Etapa 1 (base del Trofeo al Menor Pulso, Art. 42).
 * Al tocarla se abre el desglose por etapas.
 */
const LeaderboardRowBase: React.FC<LeaderboardRowProps> = ({
  entry,
  onPress,
  maxHeartRate,
  isClosed = false,
  isTrophyWinner = false,
  isRfidMode = false,
  isFeuRaid = false,
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
  const tenant = entry.representedTenant;

  // Finalizada o raid FEU en Etapa 2+: pulso de Etapa 1. Resto: último pulso.
  const { pulse, isRecheck, recheckStatus } = getDisplayPulse(entry, {
    isClosed,
    feuRaid: isFeuRaid,
  });

  const progress = !isClosed && !isOut ? getLiveProgress(entry) : null;
  const currentArrival = isClosed ? NO_TIME : getCurrentStageArrival(entry);
  const hasArrived = currentArrival !== NO_TIME;

  // Finalizada: diferencia en formato planilla y hora de llegada a meta (última etapa)
  const finalGap = formatGapHMS(entry.gapToLeaderMs, entry.totalRaceTimeMs);
  const lastStage = [...(entry.stages || [])].sort((a, b) => b.stageNumber - a.stageNumber)[0];
  const finishArrival = lastStage?.arrivalTime || entry.arrivalTime;

  return (
    <TouchableOpacity
      style={[styles.card, isOut && styles.cardOut, isTrophyWinner && { borderColor: tones.trophy }]}
      onPress={() => onPress(entry)}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel={`Posición ${showRank ? entry.rank : "sin clasificar"}, dorsal ${entry.bibNumber}, ${entry.riderName} con ${entry.horseName}`}
      accessibilityHint="Abre el desglose por etapas"
    >
      {/* Cabecera: puesto · camiseta + dorsal · estado */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          {showRank ? (
            <View style={[styles.rank, { backgroundColor: podium.bg, borderColor: podium.border }]}>
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

      {/* Binomio: jinete / 🐴 caballo. El club se omite en la lista (como en
          la vista móvil web) y se muestra en el desglose al tocar la tarjeta.
          En finalizada el pulso de Etapa 1 acompaña al binomio para liberar
          el ancho completo a las 4 métricas. */}
      <View style={styles.identityRow}>
        <View style={styles.identity}>
          <Text style={styles.rider} numberOfLines={1} ellipsizeMode="tail">
            {entry.riderName}
          </Text>
          <Text style={styles.horse} numberOfLines={1} ellipsizeMode="tail">
            🐴 {entry.horseName}
          </Text>
        </View>
        {isClosed && (
          <View style={styles.pulseCol}>
            <HeartPulseBadge
              pulse={pulse}
              maxHeartRate={maxHeartRate}
              isTrophyWinner={isTrophyWinner}
              isRecheck={isRecheck}
              recheckStatus={recheckStatus}
            />
          </View>
        )}
      </View>

      {/* Progresión en vivo (solo carrera en curso) */}
      {progress && (
        <View style={styles.progress}>
          <Text style={styles.progressText} numberOfLines={1}>
            {progress.icon} {progress.text}
          </Text>
        </View>
      )}

      {/* Métricas: consolidadas (finalizada) o de seguimiento (en curso) */}
      {isClosed ? (
        <View style={styles.finalRow}>
          <FinalMetric
            label="Llegada Meta"
            value={formatHHMMSS(finishArrival)}
            styles={styles}
            color={tones.timeAccent}
          />
          <FinalMetric label="Tiempo Total" value={formatTime(entry.totalRaceTimeMs)} styles={styles} />
          <FinalMetric
            label="Diferencia"
            value={finalGap.text}
            styles={styles}
            color={finalGap.isLeader ? tones.accent : undefined}
          />
          <FinalMetric label="Vel. Media" value={formatSpeed(entry.averageSpeed)} styles={styles} />
        </View>
      ) : (
        <View style={styles.liveRow}>
          <View style={styles.grid}>
            <Metric
              label={`Llegada E${entry.currentStage}`}
              value={currentArrival}
              styles={styles}
              color={hasArrived ? tones.timeAccent : undefined}
              strong
            />
            <Metric label="Tiempo Neto" value={formatTime(entry.totalRaceTimeMs)} styles={styles} strong />
            <Metric
              label="Diferencia"
              value={gap.text}
              styles={styles}
              color={gap.isLeader ? tones.accent : undefined}
              strong
            />
            <Metric label="Velocidad" value={formatSpeed(entry.averageSpeed)} styles={styles} />
            {isRfidMode && !!entry.nextVetControlTime && (
              <Metric
                label="Límite Vet Gate"
                value={formatHHMMSS(entry.nextVetControlTime)}
                styles={styles}
                color={tones.accent}
                strong
              />
            )}
          </View>
          <View style={styles.pulseCol}>
            <HeartPulseBadge
              pulse={pulse}
              maxHeartRate={maxHeartRate}
              isRecheck={isRecheck}
              recheckStatus={recheckStatus}
            />
          </View>
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
    <Text style={styles.metricLabel} numberOfLines={1}>
      {label}
    </Text>
    <Text
      style={[styles.metricValue, strong && styles.metricStrong, color ? { color } : null]}
      numberOfLines={1}
    >
      {value}
    </Text>
  </View>
);

/** Métrica de resultados finales: etiqueta 8.5/800 y valor 13/700 tabular. */
const FinalMetric: React.FC<{
  label: string;
  value: string;
  styles: ReturnType<typeof createStyles>;
  color?: string;
}> = ({ label, value, styles, color }) => (
  <View style={styles.finalMetric}>
    <Text style={styles.finalLabel} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
      {label}
    </Text>
    <Text
      style={[styles.finalValue, color ? { color } : null]}
      numberOfLines={1}
      adjustsFontSizeToFit
      minimumFontScale={0.75}
    >
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
      gap: 10,
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

    // Identidad: jinete / caballo (14 · 600). El club vive en StageBreakdownModal.
    identityRow: { flexDirection: "row", alignItems: "center", gap: 8 },
    identity: { flex: 1, gap: 2, minWidth: 0 },
    rider: { color: colors.textStrong, fontSize: 13, fontWeight: "600" },
    horse: { color: colors.text, fontSize: 14, fontWeight: "600" },

    progress: {
      alignSelf: "flex-start",
      backgroundColor: colors.surfaceMuted,
      borderRadius: 8,
      paddingHorizontal: 8,
      paddingVertical: 4,
      maxWidth: "100%",
    },
    progressText: { color: colors.textSecondary, fontSize: 11, fontWeight: "700" },

    // Vista en curso
    liveRow: {
      flexDirection: "row",
      alignItems: "center",
      borderTopWidth: 1,
      borderTopColor: colors.border,
      paddingTop: 10,
      gap: 8,
    },
    grid: { flex: 1, flexDirection: "row", flexWrap: "wrap", rowGap: 10, minWidth: 0 },
    metric: { width: "50%", paddingRight: 6 },

    // Vista finalizada: 4 métricas en una sola fila, columnas iguales
    finalRow: {
      flexDirection: "row",
      borderTopWidth: 1,
      borderTopColor: colors.border,
      paddingTop: 10,
      gap: 6,
    },
    finalMetric: { flex: 1, minWidth: 0 },
    finalLabel: {
      color: colors.textMuted,
      fontSize: 8.5,
      fontWeight: "800",
      textTransform: "uppercase",
      letterSpacing: 0.6,
    },
    finalValue: {
      color: colors.text,
      fontSize: 13,
      fontWeight: "700",
      fontVariant: ["tabular-nums"],
      marginTop: 2,
    },

    pulseCol: { alignItems: "center", minWidth: 56, gap: 2 },
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
    trophyNote: { fontSize: 11, fontWeight: "800" },
  });
