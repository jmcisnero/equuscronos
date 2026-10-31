import React, { useMemo } from "react";
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
} from "react-native";
import { Competition, LeaderboardEntry } from "../types";
import { HeartPulseBadge } from "./race/HeartPulseBadge";
import { RaceStatusBadge } from "./race/RaceStatusBadge";
import { Theme, useTheme, useThemedStyles } from "../theme/useTheme";
import { getRaceTones } from "../theme/raceTones";
import {
  DEFAULT_MAX_HEART_RATE,
  formatHHMMSS,
  formatSpeed,
  formatTime,
  getPreviousStages,
  getRaceStatusInfo,
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
  const { isDark } = useTheme();
  const tones = useMemo(() => getRaceTones(isDark), [isDark]);

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
  const jerseyUrl = entry.representedTenant?.jerseyImageUrl;
  const podium =
    entry.rank === 1 || entry.rank === 2 || entry.rank === 3
      ? tones.podium[entry.rank]
      : tones.podium.other;

  // Eliminación reglamentaria (F.C.A., CLAUD., RET., ...): código FEU + motivo.
  // Ocurre en la etapa en curso del binomio (p. ej. neutralización de E1).
  const isEliminated = isTerminalStatus(entry.status);
  const elimination = isEliminated ? getRaceStatusInfo(entry.status) : null;
  const eliminationStage = entry.currentStage;
  const outTone = tones.status.out;
  const eliminationBadge = elimination ? (
    <View style={[styles.elimBadge, { backgroundColor: outTone.bg, borderColor: outTone.border }]}>
      <Text style={[styles.elimCode, { color: outTone.text }]}>
        {elimination.icon} {elimination.label}
      </Text>
      {!!elimination.description && (
        <Text style={[styles.elimReason, { color: outTone.text }]}>{elimination.description}</Text>
      )}
    </View>
  ) : null;
  // ¿La etapa de la eliminación tiene tarjeta en el desglose?
  const eliminationHasCard =
    !!elimination && stages.some((s) => s.stageNumber === eliminationStage);

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
          {/* Header: misma cabecera que la tarjeta del listado
              (puesto · camiseta · dorsal | estado) + binomio */}
          <View style={styles.header}>
            <View style={styles.headerTop}>
              <View style={styles.headerLeft}>
                {showRank ? (
                  <View
                    style={[styles.rank, { backgroundColor: podium.bg, borderColor: podium.border }]}
                    accessibilityLabel={`Posición ${entry.rank}`}
                  >
                    <Text style={[styles.rankText, { color: podium.text }]}>{entry.rank}</Text>
                  </View>
                ) : (
                  <View style={styles.rankEmpty} accessibilityLabel="Sin clasificar">
                    <Text style={styles.rankEmptyText}>--</Text>
                  </View>
                )}
                {jerseyUrl ? <Image source={{ uri: jerseyUrl }} style={styles.jersey} /> : null}
                <View style={[styles.bibBadge, { backgroundColor: tones.bibBg }]}>
                  <Text style={[styles.bibText, { color: tones.bibText }]}>#{entry.bibNumber}</Text>
                </View>
              </View>
              <View style={styles.headerRight}>
                <RaceStatusBadge status={entry.status} />
                <TouchableOpacity
                  style={styles.closeBtn}
                  onPress={onClose}
                  hitSlop={8}
                  accessibilityLabel="Cerrar detalle"
                >
                  <Text style={styles.closeBtnText}>✕</Text>
                </TouchableOpacity>
              </View>
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

            <Text style={styles.sectionTitle}>DESGLOSE POR ETAPA</Text>

            {/* Estado general: solo subtítulo contextual. El detalle (código +
                motivo) se muestra una única vez en la tarjeta de la etapa; si esa
                etapa no tiene tarjeta (eliminado en ruta, sin llegada), aquí. */}
            {elimination && (
              <View style={styles.elimBanner}>
                <Text style={styles.elimBannerTitle}>
                  Eliminado en Etapa {eliminationStage}
                </Text>
                {!eliminationHasCard && eliminationBadge}
              </View>
            )}

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

                    {/* Etapa donde ocurrió la eliminación */}
                    {elimination && stage.stageNumber === eliminationStage && (
                      <View style={styles.elimStageSlot}>{eliminationBadge}</View>
                    )}
                  </View>
                );
              })
            ) : (
              // Solo si no hay llegada registrada en la Etapa 1
              // (p. ej. abandono / descalificación en los primeros km).
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
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
    paddingBottom: 12,
    gap: 2,
  },
  headerTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 10 },
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
  bibBadge: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8,
  },
  bibText: {
    fontWeight: "900",
    fontSize: 13,
    fontVariant: ["tabular-nums"],
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
    fontSize: 14,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
    marginTop: 2,
  },
  gridValueHighlight: {
    color: colors.primary,
    fontSize: 14,
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
  elimBanner: {
    marginBottom: 10,
    gap: 6,
  },
  elimBannerTitle: {
    color: colors.text,
    fontSize: 12,
    fontWeight: "800",
  },
  elimBadge: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 2,
  },
  elimCode: { fontSize: 13, fontWeight: "900" },
  elimReason: { fontSize: 11, fontWeight: "600" },
  elimStageSlot: { marginTop: 10 },
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
