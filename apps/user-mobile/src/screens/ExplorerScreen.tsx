import React, { useEffect } from "react";
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
import { CompetitionCard } from "../components/CompetitionCard";
import { useCompetitionStore } from "../store/useCompetitionStore";
import { Competition } from "../types";
import { Theme, useTheme, useThemedStyles } from "../theme/useTheme";

export const ExplorerScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const {
    competitions,
    activeCompetitionId,
    fetchCompetitions,
    selectCompetition,
    isLoading,
    statusFilter,
    setStatusFilter,
    searchQuery,
    setSearchQuery,
    competitionsError,
  } = useCompetitionStore();
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);

  useEffect(() => {
    fetchCompetitions();
  }, []);

  const handleSelect = async (comp: Competition) => {
    await selectCompetition(comp.id);
    // Finalizadas: consulta histórica sin cambiar el tab activo a "En Vivo"
    const isConcluded = comp.status === "COMPLETED" || comp.status === "OFFICIAL";
    navigation.navigate(isConcluded ? "ResultsTab" : "LiveTab");
  };

  const filteredCompetitions = competitions.filter((c) => {
    const matchesQuery =
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.location?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.tenant?.name.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesQuery) return false;

    if (statusFilter === "ACTIVE") return c.status === "ACTIVE";
    if (statusFilter === "PLANNED") return c.status === "PLANNED";
    if (statusFilter === "COMPLETED")
      return c.status === "COMPLETED" || c.status === "OFFICIAL";

    return true;
  });

  return (
    <View style={styles.container}>
      <HeaderBrand />

      <View style={styles.body}>
        {/* Barra de Búsqueda */}
        <View style={styles.searchContainer}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar competencia, club u organizador..."
            placeholderTextColor={colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery("")}>
              <Text style={styles.clearIcon}>✕</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Tabs de Filtro de Estado */}
        <View style={styles.tabsRow}>
          {[
            { id: "ALL", label: "Todas" },
            { id: "ACTIVE", label: "🔴 En Vivo" },
            { id: "PLANNED", label: "Programadas" },
            { id: "COMPLETED", label: "Finalizadas" },
          ].map((tab) => (
            <TouchableOpacity
              key={tab.id}
              style={[
                styles.tabChip,
                statusFilter === tab.id && styles.activeTabChip,
              ]}
              onPress={() => setStatusFilter(tab.id as any)}
            >
              <Text
                style={[
                  styles.tabChipText,
                  statusFilter === tab.id && styles.activeTabChipText,
                ]}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Lista de Competencias */}
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>Cargando competencias...</Text>
          </View>
        ) : (
          <FlatList
            data={filteredCompetitions}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <CompetitionCard
                competition={item}
                isSelected={item.id === activeCompetitionId}
                onPress={handleSelect}
              />
            )}
            refreshControl={
              <RefreshControl
                refreshing={isLoading}
                onRefresh={fetchCompetitions}
                tintColor={colors.primary}
                colors={[colors.primary]}
                progressBackgroundColor={colors.surface}
              />
            }
            ListEmptyComponent={
              competitionsError ? (
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyTitle}>📡 Sin conexión</Text>
                  <Text style={styles.emptySub}>{competitionsError}</Text>
                  <TouchableOpacity
                    style={styles.retryBtn}
                    onPress={fetchCompetitions}
                    accessibilityRole="button"
                  >
                    <Text style={styles.retryText}>Reintentar</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyTitle}>Sin competencias encontradas</Text>
                  <Text style={styles.emptySub}>
                    Prueba cambiando los filtros o la palabra clave de búsqueda.
                  </Text>
                </View>
              )
            }
            contentContainerStyle={styles.listContent}
          />
        )}
      </View>
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
    paddingTop: 12,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: 12,
    marginHorizontal: 16,
    paddingHorizontal: 12,
    height: 44,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 10,
    ...cardShadow,
  },
  searchIcon: {
    fontSize: 14,
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    color: colors.text,
    fontSize: 13,
  },
  clearIcon: {
    color: colors.textSecondary,
    fontSize: 14,
    padding: 4,
  },
  tabsRow: {
    flexDirection: "row",
    paddingHorizontal: 16,
    gap: 6,
    marginBottom: 12,
  },
  tabChip: {
    backgroundColor: colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  activeTabChip: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  tabChipText: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: "700",
  },
  activeTabChipText: {
    color: colors.onPrimary,
  },
  listContent: {
    paddingBottom: 24,
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
    padding: 30,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "800",
  },
  emptySub: {
    color: colors.textMuted,
    fontSize: 12,
    textAlign: "center",
    marginTop: 4,
  },
  retryBtn: {
    marginTop: 14,
    backgroundColor: colors.primary,
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 10,
  },
  retryText: {
    color: colors.onPrimary,
    fontWeight: "800",
    fontSize: 13,
  },
});
