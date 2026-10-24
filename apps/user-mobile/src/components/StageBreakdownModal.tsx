import React from "react";
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from "react-native";
import { Competition, LeaderboardEntry } from "../types";
import { HeartPulseBadge } from "./race/HeartPulseBadge";
import { RaceStatusBadge } from "./race/RaceStatusBadge";
import { Theme, useThemedStyles } from "../theme/useTheme";
import {
  DEFAULT_MAX_HEART_RATE,
  formatHHMMSS,
  formatSpeed,
  formatTime,
  getPreviousStages,
  getStagePlan,
  isTerminalStatus,
} from "../utils/raceFormat";

/** Ventana reglamentaria de toma de pulso tras el arribo (Art. 28/54 FEU). */
const PULSE_WINDOW_MS = 20 * 60 * 1000;

/** Hora asignada de ingreso al control veterinario: arribo + 20 min (HH:MM:SS). */
function formatVetControlTime(arrivalTime?: string | null): string {
  if (!arrivalTime) return "--:--:--";
  const t = new Date(arrivalTime).getTime();
  if (isNaN(t)) return "--:--:--";
  return formatHHMMSS(new Date(t + PULSE_WINDOW_MS).toISOString());
}

interface StageBreakdownModalProps {
  visible: boolean;
  entry: LeaderboardEntry | null;
  onClose: () => void;
  maxHeartRate?: number;
  /** Competencia: aporta el plan de etapas (minutos de neutralización). */
  competition?: Competition | null;
  /** Competencia finalizada: muestra totales consolidados y todas las etapas. */
  isClosed?: boolean;
  isTrophyWinner?: boolean;
}

/**
 * Desglose por etapas (Detalle Clínico). Equivalente a StageHistoryMobile de
 * la web, ampliado con hora de arribo a neutralización y minutos de descanso.
 */
export const StageBreakdownModal: React.FC<StageBreakdownModalProps> = ({
  visible,
  entry,
  onClose,
  maxHeartRate = DEFAULT_MAX_HEART_RATE,
  competition,
  isClosed = false,
  isTrophyWinner = false,
}) => {
  // Los hooks deben ejecutarse antes de cualquier return condicional.
  const styles = useThemedStyles(createStyles);

  if (!entry) return null;
  const stages = isClosed
    ? [...(entry.stages || [])].sort((a, b) => a.stageNumber - b.stageNumber)
    : getPreviousStages(entry);
  const plan = getStagePlan(competition).stages;
  // Última etapa: según el plan de la competencia o, en su defecto, la mayor registrada
  const lastPlanned = plan.length
    ? plan[plan.length - 1].stageNumber
    : (entry.stages || []).reduce<number | undefined>(
        (max, s) => (max === undefined || s.stageNumber > max ? s.stageNumber : max),
        undefined,
      );
  const isFeu = competition?.isFederated === true;
  const showRank = !!entry.rank && !isTerminalStatus(entry.status);
  const tenantName = entry.representedTenant?.name;

  /**
   * Reglamento FEU: la llegada de la última etapa es la meta final; no hay
   * neutralización ni toma de pulso de 20 min (rige balanza y sentencia).
   */
  const isFinalFeuStage = (stageNumber: number) =>
    isFeu && lastPlanned !== undefined && stageNumber >= lastPlanned;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.header}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <View style={styles.bibRow}>
                <View style={styles.bibBadge}>
                  <Text style={styles.bibText}>#{entry.bibNumber}</Text>
                </View>
                <Text style={styles.rankText}>
                  {showRank ? `Posición #${entry.rank}` : "Sin clasificar"}
                </Text>
                <RaceStatusBadge status={entry.status} />
              </View>
              <Text style={styles.riderName} numberOfLines={1}>
                {entry.riderName}
              </Text>
              <Text style={styles.horseName} numberOfLines={1} ellipsizeMode="tail">
                🐴 {entry.horseName}
              </Text>
              {!!tenantName && (
                <Text style={styles.clubName} numberOfLines={1} ellipsizeMode="tail">
                  {tenantName}
                </Text>
              )}
            </View>
            <TouchableOpacity
              style={styles.closeBtn}
              onPress={onClose}
              accessibilityLabel="Cerrar detalle"
            >
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
            {/* Totales consolidados (competencia finalizada) */}
            {isClosed && (
              <View style={styles.totals}>
                <View style={styles.totalItem}>
                  <Text style={styles.gridLabel}>PUESTO</Text>
                  <Text style={styles.totalValue}>{showRank ? `#${entry.rank}` : "--"}</Text>
                </View>
                <View style={styles.totalItem}>
                  <Text style={styles.gridLabel}>TIEMPO TOTAL</Text>
                  <Text style={styles.totalValue}>{formatTime(entry.totalRaceTimeMs)}</Text>
                </View>
                <View style={styles.totalItem}>
                  <Text style={styles.gridLabel}>VEL. MEDIA</Text>
                  <Text style={styles.totalValueAccent}>{formatSpeed(entry.averageSpeed)}</Text>
                </View>
              </View>
            )}
            {isTrophyWinner && (
              <Text style={styles.trophyNote}>🏆 Trofeo al Menor Pulso (Art. 42)</Text>
            )}

            <Text style={styles.sectionTitle}>DESGLOSE POR ETAPA (DETALLE CLÍNICO)</Text>

            {stages.length > 0 ? (
              stages.map((stage) => {
                const isFinal = isFinalFeuStage(stage.stageNumber);
                return (
                  <View key={stage.stageNumber} style={styles.stageCard}>
                    <View style={styles.stageHeader}>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={styles.stageTitle}>
                          Etapa {stage.stageNumber} ({stage.distanceKm} km)
                          {isFinal ? "  ·  META" : ""}
                        </Text>
                        <Text style={styles.stageNet}>{formatTime(stage.netTimeMs)}</Text>
                        <Text style={styles.stageNetLabel}>Tiempo neto de etapa</Text>
                      </View>
                      <HeartPulseBadge
                        pulse={stage.heartRate}
                        maxHeartRate={maxHeartRate}
                        isTrophyWinner={isTrophyWinner && stage.stageNumber === 1}
                        isRecheck={stage.isRecheck}
                        recheckStatus={stage.recheckStatus}
                      />
                    </View>

                    {/* Largada | Llegada | Toma de Pulso (arribo + 20 min) | Vel. Prom.
                        Igual que la planilla oficial / public-web. En la última etapa
                        FEU no hay toma de pulso de 20 min (rige meta). */}
                    <View style={styles.stageGrid}>
                      <GridItem label="LARGADA" value={formatHHMMSS(stage.startTime)} styles={styles} />
                      <GridItem label="LLEGADA" value={formatHHMMSS(stage.arrivalTime)} styles={styles} />
                      {!isFinal && (
                        <GridItem
                          label="TOMA DE PULSO"
                          value={formatVetControlTime(stage.arrivalTime)}
                          styles={styles}
                        />
                      )}
                      <GridItem label="VEL. PROM." value={formatSpeed(stage.averageSpeed)} styles={styles} highlight />
                    </View>
                  </View>
                );
              })
            ) : (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>
                  Aún no hay etapas completadas para este binomio.
                </Text>
              </View>
            )}
          </ScrollView>

          <TouchableOpacity style={styles.footerButton} onPress={onClose}>
            <Text style={styles.footerButtonText}>Cerrar Detalle</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const GridItem: React.FC<{
  label: string;
  value: string;
  styles: ReturnType<typeof createStyles>;
  highlight?: boolean;
}> = ({ label, value, styles, highlight }) => (
  <View style={styles.gridItem}>
    <Text style={styles.gridLabel} numberOfLines={1}>
      {label}
    </Text>
    <Text style={highlight ? styles.gridValueHighlight : styles.gridValue}>{value}</Text>
  </View>
);

const createStyles = ({ colors, isDark }: Theme) =>
  StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: isDark ? colors.background : colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "82%",
    padding: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
    paddingBottom: 12,
  },
  bibRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  bibBadge: {
    backgroundColor: colors.primary,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  bibText: {
    color: colors.onPrimary,
    fontWeight: "900",
    fontSize: 10,
  },
  rankText: {
    color: colors.warning,
    fontWeight: "800",
    fontSize: 12,
  },
  riderName: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "700",
  },
  horseName: {
    color: colors.textStrong,
    fontSize: 14,
    fontWeight: "800",
    marginTop: 2,
  },
  clubName: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "600",
    marginTop: 2,
  },
  totals: {
    flexDirection: "row",
    backgroundColor: isDark ? colors.surface : colors.background,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    marginBottom: 10,
  },
  totalItem: { flex: 1, alignItems: "center" },
  totalValue: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "900",
    fontVariant: ["tabular-nums"],
    marginTop: 3,
  },
  totalValueAccent: {
    color: colors.primary,
    fontSize: 15,
    fontWeight: "900",
    fontVariant: ["tabular-nums"],
    marginTop: 3,
  },
  trophyNote: {
    color: colors.warning,
    fontSize: 12,
    fontWeight: "800",
    marginBottom: 10,
  },
  stageNet: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "900",
    fontVariant: ["tabular-nums"],
    marginTop: 4,
  },
  stageNetLabel: {
    color: colors.textMuted,
    fontSize: 9,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surfaceMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  closeBtnText: {
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: "800",
  },
  body: {
    marginVertical: 14,
  },
  sectionTitle: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1,
    marginBottom: 10,
  },
  stageCard: {
    backgroundColor: isDark ? colors.surface : colors.background,
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  stageHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 8,
    marginBottom: 10,
  },
  stageTitle: {
    color: colors.text,
    fontWeight: "800",
    fontSize: 13,
  },
  stageGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    justifyContent: "space-between",
    backgroundColor: isDark ? colors.surfaceSunken : colors.surface,
    padding: 10,
    borderRadius: 8,
  },
  gridItem: {
    width: "47%",
  },
  gridLabel: {
    color: colors.textMuted,
    fontSize: 9.5,
    fontWeight: "800",
  },
  gridValue: {
    color: colors.textStrong,
    fontSize: 13,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
    marginTop: 2,
  },
  gridValueHighlight: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
    marginTop: 2,
  },
  pulseCell: {
    alignItems: "flex-start",
    marginTop: 2,
  },
  emptyContainer: {
    padding: 20,
    alignItems: "center",
  },
  emptyText: {
    color: colors.textMuted,
    textAlign: "center",
    fontSize: 12,
  },
  footerButton: {
    backgroundColor: colors.primary,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
  },
  footerButtonText: {
    color: colors.onPrimary,
    fontWeight: "800",
    fontSize: 14,
  },
});
