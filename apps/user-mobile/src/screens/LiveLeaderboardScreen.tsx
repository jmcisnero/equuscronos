import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { HeaderBrand } from "../components/HeaderBrand";
import { LeaderboardRow } from "../components/LeaderboardRow";
import { StageBreakdownModal } from "../components/StageBreakdownModal";
import { useCompetitionStore } from "../store/useCompetitionStore";
import { useLiveLeaderboardMobile } from "../hooks/useLiveLeaderboardMobile";
import { LeaderboardEntry } from "../types";
import { Theme, useTheme, useThemedStyles } from "../theme/useTheme";

export const LiveLeaderboardScreen: React.FC = () => {
  const {
    activeCompetition,
    activeCompetitionId,
    searchQuery,
    setSearchQuery,
  } = useCompetitionStore();
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);

  const {
    leaderboard,
    isLoading,
    isClosed,
    isFallbackPolling,
    countdown,
    refresh,
  } = useLiveLeaderboardMobile(activeCompetitionId);

  const [selectedEntry, setSelectedEntry] = useState<LeaderboardEntry | null>(null);
  const [modalVisible, setModalVisible] = useState(false);

  const handleRowPress = (entry: LeaderboardEntry) => {
    setSelectedEntry(entry);
    setModalVisible(true);
  };

  const filteredLeaderboard = leaderboard.filter((item) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      item.riderName.toLowerCase().includes(query) ||
      item.horseName.toLowerCase().includes(query) ||
      item.bibNumber.toString().includes(query)
    );
  });

  return (
    <View style={styles.container}>
      <HeaderBrand />

      <View style={styles.body}>
        {/* Banner de Competencia Seleccionada */}
        <View style={styles.competitionBanner}>
          <View style={{ flex: 1 }}>
            <Text style={styles.compLabel}>COMPETENCIA EN MONITOREO</Text>
            <Text style={styles.compTitle} numberOfLines={1}>
              {activeCompetition?.name || "Selecciona una competencia..."}
            </Text>
          </View>
          {isFallbackPolling && !isClosed && (
            <View style={styles.pollingCounter}>
              <Text style={styles.counterText}>REST {countdown}s</Text>
            </View>
          )}
        </View>

        {/* Buscador de Binomios */}
        <View style={styles.searchContainer}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Filtrar por Dorsal, Jinete o Caballo..."
            placeholderTextColor={colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        {/* Lista Leaderboard */}
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>Cargando cronometraje en vivo...</Text>
          </View>
        ) : (
          <FlatList
            data={filteredLeaderboard}
            keyExtractor={(item, index) => `${item.bibNumber}-${index}`}
            renderItem={({ item }) => (
              <LeaderboardRow
                entry={item}
                onPress={handleRowPress}
                maxHeartRate={activeCompetition?.maxHeartRate || 64}
              />
            )}
            refreshControl={
              <RefreshControl
                refreshing={isLoading}
                onRefresh={refresh}
                tintColor={colors.primary}
                colors={[colors.primary]}
                progressBackgroundColor={colors.surface}
              />
            }
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyTitle}>Sin datos de carrera aún</Text>
                <Text style={styles.emptySub}>
                  No hay registros transmitidos para el filtro ingresado.
                </Text>
              </View>
            }
            contentContainerStyle={styles.listContent}
          />
        )}
      </View>

      {/* Modal Desglose de Etapas */}
      <StageBreakdownModal
        visible={modalVisible}
        entry={selectedEntry}
        onClose={() => setModalVisible(false)}
        maxHeartRate={activeCompetition?.maxHeartRate || 64}
      />
    </View>
  );
};

const createStyles = ({ colors, cardShadow }: Theme) =>
  StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  body: {
    flex: 1,
    paddingTop: 8,
  },
  competitionBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.surface,
    marginHorizontal: 16,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 8,
    ...cardShadow,
  },
  compLabel: {
    color: colors.primary,
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
  compTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "800",
    marginTop: 2,
  },
  pollingCounter: {
    backgroundColor: colors.warningSoft,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.warning,
  },
  counterText: {
    color: colors.warning,
    fontSize: 10,
    fontWeight: "800",
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: 10,
    marginHorizontal: 16,
    paddingHorizontal: 10,
    height: 40,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 8,
  },
  searchIcon: {
    fontSize: 12,
    marginRight: 6,
  },
  searchInput: {
    flex: 1,
    color: colors.text,
    fontSize: 12,
  },
  listContent: {
    paddingBottom: 20,
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    color: colors.textSecondary,
    fontSize: 12,
    marginTop: 10,
  },
  emptyContainer: {
    alignItems: "center",
    padding: 40,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "800",
  },
  emptySub: {
    color: colors.textMuted,
    fontSize: 11,
    textAlign: "center",
    marginTop: 4,
  },
});
