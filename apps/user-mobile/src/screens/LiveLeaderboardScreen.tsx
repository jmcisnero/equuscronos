import React, { useCallback, useMemo, useState } from "react";
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
import { computeTrophyWinnerBib, DEFAULT_MAX_HEART_RATE } from "../utils/raceFormat";

/**
 * Detalle de carrera. Equivalente móvil de public-web/app/leaderboard/[id]:
 * resumen del Raid + buscador + tablero en vivo (LeaderboardTable) o
 * resultados finales con Trofeo al Menor Pulso (FinalResultsTable).
 */
export const LiveLeaderboardScreen: React.FC = () => {
  const { activeCompetition, activeCompetitionId, searchQuery, setSearchQuery } =
    useCompetitionStore();
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);

  const { leaderboard, isLoading, isClosed, isFallbackPolling, countdown, refresh } =
    useLiveLeaderboardMobile(activeCompetitionId);

  const [selectedEntry, setSelectedEntry] = useState<LeaderboardEntry | null>(null);
  const [modalVisible, setModalVisible] = useState(false);

  const maxHeartRate = activeCompetition?.maxHeartRate || DEFAULT_MAX_HEART_RATE;
  const isRfidMode = activeCompetition?.enableRfidChips === true;

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
  const hasNoCompleted = useMemo(
    () => leaderboard.some((e) => e.status === "NO_COMPLETED"),
    [leaderboard],
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
      />
    ),
    [handleRowPress, maxHeartRate, isClosed, trophyBib, isRfidMode],
  );

  const listHeader = (
    <View>
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

      {/* Aviso de cierre de control con binomios N.C. (igual que la web) */}
      {isClosed && hasNoCompleted && (
        <View style={styles.ncBanner}>
          <Text style={styles.ncIcon}>ℹ️</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.ncTitle}>Control de Meta Cerrado (Tiempo Expirado)</Text>
            <Text style={styles.ncText}>
              Los binomios que no completaron la meta dentro del tiempo límite reglamentario
              figuran como "No Completó" (N.C.).
            </Text>
          </View>
        </View>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      <HeaderBrand />

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Cargando cronometraje en vivo...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredLeaderboard}
          keyExtractor={(item) => String(item.bibNumber)}
          renderItem={renderItem}
          ListHeaderComponent={listHeader}
          keyboardShouldPersistTaps="handled"
          initialNumToRender={8}
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
                {searchQuery ? "Sin coincidencias" : "Sin datos de carrera aún"}
              </Text>
              <Text style={styles.emptySub}>
                {searchQuery
                  ? "No se encontraron binomios que coincidan con la búsqueda."
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
      />
    </View>
  );
};

const createStyles = ({ colors, isDark }: Theme) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    listContent: { paddingBottom: 24 },
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
    ncBanner: {
      flexDirection: "row",
      gap: 10,
      marginHorizontal: 16,
      marginTop: 8,
      padding: 12,
      borderRadius: 14,
      backgroundColor: isDark ? colors.surface : colors.surfaceSunken,
      borderWidth: 1,
      borderColor: colors.border,
    },
    ncIcon: { fontSize: 16 },
    ncTitle: { color: colors.text, fontSize: 13, fontWeight: "900" },
    ncText: { color: colors.textSecondary, fontSize: 11, marginTop: 2, lineHeight: 15 },
    loadingContainer: { flex: 1, alignItems: "center", justifyContent: "center" },
    loadingText: { color: colors.textSecondary, fontSize: 12, marginTop: 10 },
    emptyContainer: { alignItems: "center", padding: 32 },
    emptyTitle: { color: colors.text, fontSize: 15, fontWeight: "800" },
    emptySub: { color: colors.textMuted, fontSize: 12, textAlign: "center", marginTop: 4 },
  });
