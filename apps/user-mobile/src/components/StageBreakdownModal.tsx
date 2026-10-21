import React from "react";
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from "react-native";
import { LeaderboardEntry } from "../types";
import { HeartPulseBadge } from "./race/HeartPulseBadge";
import { RaceStatusBadge } from "./race/RaceStatusBadge";
import { Theme, useThemedStyles } from "../theme/useTheme";
import {
  DEFAULT_MAX_HEART_RATE,
  formatHHMMSS,
  formatSpeed,
  formatTime,
  getPreviousStages,
  isTerminalStatus,
} from "../utils/raceFormat";

interface StageBreakdownModalProps {
  visible: boolean;
  entry: LeaderboardEntry | null;
  onClose: () => void;
  maxHeartRate?: number;
}

/** Historial de etapas (Detalle Clínico) — equivalente a StageHistoryMobile de la web. */
export const StageBreakdownModal: React.FC<StageBreakdownModalProps> = ({
  visible,
  entry,
  onClose,
  maxHeartRate = DEFAULT_MAX_HEART_RATE,
}) => {
  // Los hooks deben ejecutarse antes de cualquier return condicional.
  const styles = useThemedStyles(createStyles);

  if (!entry) return null;
  const stages = getPreviousStages(entry);
  const showRank = !!entry.rank && !isTerminalStatus(entry.status);

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
            <View style={{ flex: 1 }}>
              <View style={styles.bibRow}>
                <View style={styles.bibBadge}>
                  <Text style={styles.bibText}>#{entry.bibNumber}</Text>
                </View>
                <Text style={styles.rankText}>
                  {showRank ? `Posición #${entry.rank}` : "Sin clasificar"}
                </Text>
                <RaceStatusBadge status={entry.status} />
              </View>
              <Text style={styles.riderName}>{entry.riderName}</Text>
              <Text style={styles.horseName}>Caballo: {entry.horseName}</Text>
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
            <Text style={styles.sectionTitle}>HISTORIAL DE ETAPAS (DETALLE CLÍNICO)</Text>

            {stages.length > 0 ? (
              stages.map((stage) => (
                <View key={stage.stageNumber} style={styles.stageCard}>
                  <View style={styles.stageHeader}>
                    <Text style={styles.stageTitle}>
                      ETAPA {stage.stageNumber} • {stage.distanceKm} KM
                    </Text>
                    <HeartPulseBadge
                      pulse={stage.heartRate}
                      maxHeartRate={maxHeartRate}
                      isRecheck={stage.isRecheck}
                      recheckStatus={stage.recheckStatus}
                    />
                  </View>

                  <View style={styles.stageGrid}>
                    <View style={styles.gridItem}>
                      <Text style={styles.gridLabel}>Salida</Text>
                      <Text style={styles.gridValue}>{formatHHMMSS(stage.startTime)}</Text>
                    </View>
                    <View style={styles.gridItem}>
                      <Text style={styles.gridLabel}>Llegada</Text>
                      <Text style={styles.gridValue}>{formatHHMMSS(stage.arrivalTime)}</Text>
                    </View>
                    <View style={styles.gridItem}>
                      <Text style={styles.gridLabel}>Toma de Pulso</Text>
                      <Text style={styles.gridValue}>{formatHHMMSS(stage.vetInTime)}</Text>
                    </View>
                    <View style={styles.gridItem}>
                      <Text style={styles.gridLabel}>Tiempo Neto</Text>
                      <Text style={styles.gridValue}>{formatTime(stage.netTimeMs)}</Text>
                    </View>
                    <View style={styles.gridItem}>
                      <Text style={styles.gridLabel}>Velocidad Etapa</Text>
                      <Text style={styles.gridValueHighlight}>{formatSpeed(stage.averageSpeed)}</Text>
                    </View>
                  </View>
                </View>
              ))
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
    fontSize: 18,
    fontWeight: "900",
  },
  horseName: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: "600",
    marginTop: 2,
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
    alignItems: "center",
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
    fontSize: 9,
    fontWeight: "600",
  },
  gridValue: {
    color: colors.textStrong,
    fontSize: 11,
    fontWeight: "700",
    marginTop: 2,
  },
  gridValueHighlight: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: "800",
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
