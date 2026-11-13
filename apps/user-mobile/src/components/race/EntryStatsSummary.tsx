import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { CompetitionEntryStats } from "../../types";
import { Theme, useTheme, useThemedStyles } from "../../theme/useTheme";

interface EntryStatsSummaryProps {
  status: string;
  entryStats?: CompetitionEntryStats | null;
  /** Permite ajustar márgenes si se ubica en RaceSummaryCard o CompetitionCard */
  compact?: boolean;
}

/**
 * Bloque de resumen estadístico de binomios - Opción 7:
 * Contenedor Unificado con Divisores Verticales + Emojis Oficiales de RaceStatusBadge + Barra de Supervivencia de 4px.
 * - FINALIZADA (COMPLETED/OFFICIAL): 🐎 {total} | 🏁 Finalizaron: {finished} | 🛑 Elim./Ret.: {eliminated}
 * - EN VIVO (ACTIVE): 🐎 {total} | 🏇 Ruta: {inRace} | ⏱️ Neut/Vet: {resting + vetCheck} | 🛑 Bajas: {eliminated}
 * - PLANIFICADA (PLANNED): 🐎 Inscriptos: {total}
 */
export const EntryStatsSummary: React.FC<EntryStatsSummaryProps> = ({
  status,
  entryStats,
  compact = true,
}) => {
  const { colors, isDark } = useTheme();
  const styles = useThemedStyles(createStyles);

  if (!entryStats || entryStats.total <= 0) {
    return null;
  }

  const isCompleted = status === "COMPLETED" || status === "OFFICIAL";
  const isActive = status === "ACTIVE";
  const isPlanned = status === "PLANNED";

  const total = entryStats.total;

  // Tonos atenuados para la micro-barra de supervivencia (4px)
  const barGreen = isDark ? "rgba(52, 211, 153, 0.45)" : "rgba(28, 79, 56, 0.55)";
  const barAmber = isDark ? "rgba(251, 191, 36, 0.45)" : "rgba(197, 138, 65, 0.55)";
  const barRed = isDark ? "rgba(248, 113, 113, 0.42)" : "rgba(239, 68, 68, 0.45)";

  if (isCompleted) {
    const finished = entryStats.finished || 0;
    const eliminated = entryStats.eliminated || 0;
    const pctFin = Math.min(100, Math.max(0, (finished / total) * 100));
    const pctElim = Math.min(100 - pctFin, Math.max(0, (eliminated / total) * 100));

    return (
      <View style={[styles.container, compact && styles.compactContainer]}>
        <View style={styles.metricsRow}>
          {/* Total: con etiqueta explícita Total: */}
          <View style={styles.item}>
            <Text style={styles.emoji} allowFontScaling={false}>🐎</Text>
            <Text style={styles.label}>Total: </Text>
            <Text style={styles.totalValue}>{total}</Text>
          </View>

          <View style={styles.divider} />

          {/* Finalizaron */}
          <View style={styles.item}>
            <Text style={styles.emoji} allowFontScaling={false}>🏁</Text>
            <Text style={styles.greenText}>Finalizaron: </Text>
            <Text style={[styles.value, styles.greenText]}>{finished}</Text>
          </View>

          <View style={styles.divider} />

          {/* Eliminados / Retirados - Icono atenuado en finalizadas */}
          <View style={styles.item}>
            <Text style={[styles.emoji, styles.mutedEmoji]} allowFontScaling={false}>🛑</Text>
            <Text style={styles.redText}>Elim./Ret.: </Text>
            <Text style={[styles.value, styles.redText]}>{eliminated}</Text>
          </View>
        </View>

        {/* Micro-barra de supervivencia (4px) */}
        <View style={styles.progressBar}>
          {pctFin > 0 && (
            <View style={[styles.progressSegment, { width: `${pctFin}%`, backgroundColor: barGreen }]} />
          )}
          {pctElim > 0 && (
            <View style={[styles.progressSegment, { width: `${pctElim}%`, backgroundColor: barRed }]} />
          )}
        </View>
      </View>
    );
  }

  if (isActive) {
    const inRace = entryStats.inRace || 0;
    const restingPlusVet = (entryStats.resting || 0) + (entryStats.vetCheck || 0);
    const eliminated = entryStats.eliminated || 0;
    const finished = entryStats.finished || 0;

    const pctInRace = Math.min(100, Math.max(0, (inRace / total) * 100));
    const pctVet = Math.min(100 - pctInRace, Math.max(0, (restingPlusVet / total) * 100));
    const pctElim = Math.min(100 - pctInRace - pctVet, Math.max(0, (eliminated / total) * 100));
    const pctFin = Math.max(0, 100 - pctInRace - pctVet - pctElim);

    return (
      <View style={[styles.container, compact && styles.compactContainer]}>
        <View style={styles.metricsRow}>
          {/* Total */}
          <View style={styles.item}>
            <Text style={styles.emoji} allowFontScaling={false}>🐎</Text>
            <Text style={styles.totalValue}>{total}</Text>
          </View>

          <View style={styles.divider} />

          {/* En Ruta */}
          <View style={styles.item}>
            <Text style={styles.emoji} allowFontScaling={false}>🏇</Text>
            <Text style={styles.greenText}>Ruta: </Text>
            <Text style={[styles.value, styles.greenText]}>{inRace}</Text>
          </View>

          <View style={styles.divider} />

          {/* Neutralización / Vet */}
          <View style={styles.item}>
            <Text style={styles.emoji} allowFontScaling={false}>⏱️</Text>
            <Text style={styles.amberText}>Neut/Vet: </Text>
            <Text style={[styles.value, styles.amberText]}>{restingPlusVet}</Text>
          </View>

          <View style={styles.divider} />

          {/* Bajas */}
          <View style={styles.item}>
            <Text style={styles.emoji} allowFontScaling={false}>🛑</Text>
            <Text style={styles.redText}>Bajas: </Text>
            <Text style={[styles.value, styles.redText]}>{eliminated}</Text>
          </View>
        </View>

        {/* Micro-barra de supervivencia (4px) */}
        <View style={styles.progressBar}>
          {pctInRace > 0 && (
            <View style={[styles.progressSegment, { width: `${pctInRace}%`, backgroundColor: barGreen }]} />
          )}
          {pctVet > 0 && (
            <View style={[styles.progressSegment, { width: `${pctVet}%`, backgroundColor: barAmber }]} />
          )}
          {pctFin > 0 && finished > 0 && (
            <View style={[styles.progressSegment, { width: `${pctFin}%`, backgroundColor: barGreen }]} />
          )}
          {pctElim > 0 && (
            <View style={[styles.progressSegment, { width: `${pctElim}%`, backgroundColor: barRed }]} />
          )}
        </View>
      </View>
    );
  }

  if (isPlanned && total > 0) {
    return (
      <View style={[styles.container, compact && styles.compactContainer]}>
        <View style={styles.metricsRow}>
          <View style={styles.item}>
            <Text style={styles.emoji} allowFontScaling={false}>🐎</Text>
            <Text style={styles.label}>Inscriptos: </Text>
            <Text style={styles.totalValue}>{total}</Text>
          </View>
        </View>
      </View>
    );
  }

  return null;
};

const createStyles = ({ colors, isDark }: Theme) =>
  StyleSheet.create({
    container: {
      backgroundColor: isDark ? "rgba(30, 41, 59, 0.7)" : "#F8FAFC",
      borderRadius: 12,
      borderWidth: 1,
      borderColor: isDark ? "rgba(100, 116, 139, 0.3)" : "rgba(226, 232, 240, 0.9)",
      overflow: "hidden",
    },
    compactContainer: {
      marginVertical: 4,
    },
    metricsRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: 5.5,
      paddingHorizontal: 8,
    },
    item: {
      flexDirection: "row",
      alignItems: "center",
    },
    emoji: {
      fontSize: 11,
      marginRight: 3,
      lineHeight: 14,
    },
    mutedEmoji: {
      opacity: 0.55,
    },
    totalValue: {
      color: colors.text,
      fontSize: 11.5,
      fontWeight: "900",
      fontVariant: ["tabular-nums"],
      lineHeight: 14,
    },
    label: {
      color: colors.textSecondary,
      fontSize: 10.5,
      fontWeight: "700",
      lineHeight: 14,
    },
    value: {
      fontSize: 11,
      fontWeight: "900",
      fontVariant: ["tabular-nums"],
      lineHeight: 14,
    },
    greenText: {
      color: isDark ? "#34D399" : "#1C4F38",
      fontSize: 10.5,
      fontWeight: "800",
      lineHeight: 14,
    },
    amberText: {
      color: isDark ? "#FBBF24" : "#966324",
      fontSize: 10.5,
      fontWeight: "800",
      lineHeight: 14,
    },
    redText: {
      color: isDark ? "#F87171" : "#DC2626",
      fontSize: 10.5,
      fontWeight: "800",
      lineHeight: 14,
    },
    divider: {
      width: 1,
      height: 14,
      backgroundColor: isDark ? "rgba(148, 163, 184, 0.25)" : "rgba(203, 213, 225, 0.8)",
    },
    progressBar: {
      width: "100%",
      height: 4,
      backgroundColor: isDark ? "rgba(148, 163, 184, 0.10)" : "rgba(148, 163, 184, 0.14)",
      flexDirection: "row",
    },
    progressSegment: {
      height: 4,
    },
  });
