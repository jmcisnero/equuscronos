import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
} from "react-native";
import { HeaderBrand } from "../components/HeaderBrand";
import { LeaderboardRow } from "../components/LeaderboardRow";
import { StageBreakdownModal } from "../components/StageBreakdownModal";
import { RaceSummaryCard } from "../components/race/RaceSummaryCard";
import { useCompetitionStore } from "../store/useCompetitionStore";
import { useLiveLeaderboardMobile } from "../hooks/useLiveLeaderboardMobile";
import { LeaderboardEntry } from "../types";
import { Theme, useTheme, useThemedStyles } from "../theme/useTheme";
import { computeTrophyWinnerBib, DEFAULT_MAX_HEART_RATE, isFeuRaid } from "../utils/raceFormat";
import { useIsFocused } from "@react-navigation/native";

const CONCLUDED_STATUSES = ["COMPLETED", "OFFICIAL"];
const keyExtractor = (item: LeaderboardEntry) => String(item.bibNumber);

/**
 * Detalle de carrera. Equivalente móvil de public-web/app/leaderboard/[id]:
 * resumen del Raid + buscador + tablero en vivo (LeaderboardTable) o
 * resultados finales con Trofeo al Menor Pulso (FinalResultsTable).
 *
 * mode="results": consulta histórica abierta desde Explorar (ruta oculta
 * ResultsTab). No abre WebSocket y mantiene el foco visual en "Explorar".
 */
export const LiveLeaderboardScreen: React.FC<{
  navigation?: any;
  mode?: "live" | "results";
}> = ({ navigation, mode = "live" }) => {
  const {
    activeCompetition,
    activeCompetitionId,
    searchQuery,
    setSearchQuery,
    leaderboardError,
    competitions,
    selectCompetition,
    isLoading: isCompetitionsLoading,
  } = useCompetitionStore();
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const isFocused = useIsFocused();

  const selectionConcluded = CONCLUDED_STATUSES.includes(activeCompetition?.status ?? "");
  const isConcluded = mode === "results" || selectionConcluded;

  // Pestaña "En Vivo": nunca muestra datos residuales de competencias finalizadas.
  // Si hay una ACTIVE disponible se cambia a ella; si no, se muestra el empty state.
  const liveCompetition = useMemo(
    () => competitions.find((c) => c.status === "ACTIVE"),
    [competitions],
  );
  const showNoLiveState =
    mode === "live" && !isCompetitionsLoading && (!activeCompetitionId || selectionConcluded);

  useEffect(() => {
    if (mode === "live" && isFocused && selectionConcluded && liveCompetition) {
      selectCompetition(liveCompetition.id);
    }
  }, [mode, isFocused, selectionConcluded, liveCompetition, selectCompetition]);

  const { leaderboard, isLoading, isClosed: socketClosed, isFallbackPolling, countdown, refresh } =
    useLiveLeaderboardMobile(activeCompetitionId, { live: isFocused && !isConcluded });
  const isClosed = socketClosed || isConcluded;

  const [selectedEntry, setSelectedEntry] = useState<LeaderboardEntry | null>(null);
  const [modalVisible, setModalVisible] = useState(false);

  const maxHeartRate = activeCompetition?.maxHeartRate || DEFAULT_MAX_HEART_RATE;
  const isRfidMode = activeCompetition?.enableRfidChips === true;
  const feuRaid = isFeuRaid(activeCompetition);

  const handleRowPress = useCallback((entry: LeaderboardEntry) => {
    setSelectedEntry(entry);
    setModalVisible(true);
  }, []);

  const filteredLeaderboard = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return leaderboard;
    return leaderboard.filter(
      (item) =>
        item.riderName.toLowerCase().includes(q) ||
        item.horseName.toLowerCase().includes(q) ||
        item.bibNumber.toString().includes(q),
    );
  }, [leaderboard, searchQuery]);

  // Trofeo FEU (Art. 42): se calcula sobre el tablero completo, no el filtrado
  const trophyBib = useMemo(
    () => (isClosed ? computeTrophyWinnerBib(leaderboard) : null),
    [isClosed, leaderboard],
  );

  const renderItem = useCallback(
    ({ item }: { item: LeaderboardEntry }) => (
      <LeaderboardRow
        entry={item}
        onPress={handleRowPress}
        maxHeartRate={maxHeartRate}
        isClosed={isClosed}
        isTrophyWinner={item.bibNumber === trophyBib}
        isRfidMode={isRfidMode}
        isFeuRaid={feuRaid}
      />
    ),
    [handleRowPress, maxHeartRate, isClosed, trophyBib, isRfidMode, feuRaid],
  );

  const listHeader = (
    <View>
      {mode === "results" && (
        <View style={styles.resultsBar}>
          <TouchableOpacity
            onPress={() => navigation?.navigate("ExplorerTab")}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Volver a Explorar"
          >
            <Text style={styles.backText}>‹ Explorar</Text>
          </TouchableOpacity>
          <Text style={styles.resultsTitle} accessibilityRole="header">
            Resultados Finales
          </Text>
        </View>
      )}
      <RaceSummaryCard
        competition={activeCompetition}
        maxHeartRate={maxHeartRate}
        isClosed={isClosed}
      />

      {/* Buscador de binomios */}
      <View style={styles.searchContainer}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar por Jinete, Caballo o Dorsal..."
          placeholderTextColor={colors.textMuted}
          value={searchQuery}
          onChangeText={setSearchQuery}
          returnKeyType="search"
          accessibilityLabel="Buscar binomio"
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery("")} hitSlop={8}>
            <Text style={styles.clearIcon}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Título de sección + estado de sincronización */}
      <View style={styles.sectionRow}>
        <Text style={styles.sectionTitle} accessibilityRole="header">
          {isClosed ? "Clasificación General" : "Seguimiento en Vivo"}
        </Text>
        {isFallbackPolling && !isClosed && (
          <View style={styles.pollingCounter}>
            <Text style={styles.counterText}>Actualiza en {countdown}s</Text>
          </View>
        )}
      </View>
    </View>
  );

  if (showNoLiveState && !liveCompetition) {
    return (
      <View style={styles.container}>
        <HeaderBrand />
        <View style={styles.noLiveContainer}>
          <View style={styles.noLiveIconRing}>
            <Text style={styles.noLiveIcon}>⏱️</Text>
          </View>
          <Text style={styles.noLiveTitle} accessibilityRole="header">
            No hay competencias en vivo en este momento
          </Text>
          <Text style={styles.noLiveSub}>
            Consulta el calendario o los resultados de competencias anteriores.
          </Text>
          <TouchableOpacity
            style={styles.noLiveButton}
            onPress={() => navigation?.navigate("ExplorerTab")}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Ir a Explorar"
          >
            <Text style={styles.noLiveButtonText}>Explorar competencias</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <HeaderBrand />

      {isLoading || (showNoLiveState && !!liveCompetition) ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>
            {isConcluded ? "Cargando resultados finales..." : "Cargando cronometraje en vivo..."}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredLeaderboard}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          ListHeaderComponent={listHeader}
          keyboardShouldPersistTaps="handled"
          initialNumToRender={8}
          maxToRenderPerBatch={8}
          updateCellsBatchingPeriod={50}
          windowSize={7}
          removeClippedSubviews
          refreshControl={
            <RefreshControl
              refreshing={false}
              onRefresh={refresh}
              tintColor={colors.primary}
              colors={[colors.primary]}
              progressBackgroundColor={colors.surface}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyTitle}>
                {searchQuery
                  ? "Sin coincidencias"
                  : leaderboardError
                  ? "📡 Sin conexión"
                  : "Sin datos de carrera aún"}
              </Text>
              <Text style={styles.emptySub}>
                {searchQuery
                  ? "No se encontraron binomios que coincidan con la búsqueda."
                  : leaderboardError
                  ? leaderboardError
                  : "Los tiempos aparecerán aquí en cuanto se registre la largada."}
              </Text>
            </View>
          }
          contentContainerStyle={styles.listContent}
        />
      )}

      <StageBreakdownModal
        visible={modalVisible}
        entry={selectedEntry}
        onClose={() => setModalVisible(false)}
        maxHeartRate={maxHeartRate}
        competition={activeCompetition}
        isClosed={isClosed}
        isTrophyWinner={!!selectedEntry && selectedEntry.bibNumber === trophyBib}
      />
    </View>
  );
};

const createStyles = ({ colors, isDark }: Theme) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    listContent: { paddingBottom: 24 },
    resultsBar: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      marginHorizontal: 16,
      marginTop: 10,
    },
    backText: { color: colors.primary, fontSize: 14, fontWeight: "800" },
    resultsTitle: { color: colors.text, fontSize: 18, fontWeight: "900" },
    searchContainer: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.surface,
      borderRadius: 12,
      marginHorizontal: 16,
      marginTop: 4,
      paddingHorizontal: 12,
      height: 46,
      borderWidth: 1,
      borderColor: colors.border,
    },
    searchIcon: { fontSize: 14, marginRight: 8 },
    searchInput: { flex: 1, color: colors.text, fontSize: 14 },
    clearIcon: { color: colors.textSecondary, fontSize: 14, padding: 4 },
    sectionRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginHorizontal: 16,
      marginTop: 16,
      marginBottom: 4,
    },
    sectionTitle: { color: colors.text, fontSize: 16, fontWeight: "900" },
    pollingCounter: {
      backgroundColor: colors.warningSoft,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.warningBorder,
    },
    counterText: { color: colors.warning, fontSize: 10, fontWeight: "800" },
    loadingContainer: { flex: 1, alignItems: "center", justifyContent: "center" },
    loadingText: { color: colors.textSecondary, fontSize: 12, marginTop: 10 },
    noLiveContainer: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 32,
      paddingBottom: 48,
    },
    noLiveIconRing: {
      width: 88,
      height: 88,
      borderRadius: 44,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.surfaceMuted,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: 20,
    },
    noLiveIcon: { fontSize: 38, opacity: isDark ? 0.45 : 0.4 },
    noLiveTitle: {
      color: colors.text,
      fontSize: 17,
      fontWeight: "900",
      textAlign: "center",
      lineHeight: 23,
    },
    noLiveSub: {
      color: colors.textSecondary,
      fontSize: 13,
      textAlign: "center",
      marginTop: 8,
      lineHeight: 18,
    },
    noLiveButton: {
      marginTop: 24,
      backgroundColor: colors.primary,
      paddingHorizontal: 22,
      paddingVertical: 12,
      borderRadius: 12,
    },
    noLiveButtonText: { color: colors.onPrimary, fontSize: 14, fontWeight: "800" },
    emptyContainer: { alignItems: "center", padding: 32 },
    emptyTitle: { color: colors.text, fontSize: 15, fontWeight: "800" },
    emptySub: { color: colors.textMuted, fontSize: 12, textAlign: "center", marginTop: 4 },
  });
