import React, { useState, useEffect } from "react";
import {
  SafeAreaView,
  StyleSheet,
  Text,
  View,
  FlatList,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
  ScrollView,
  TextInput,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { colors } from "./src/theme/colors";
import { initDatabase, getDatabase } from "./src/database/db";
import { LocalCompetitionEntry } from "./src/database/schema";
import SyncService from "./src/services/SyncService";
import ApiService from "./src/services/ApiService";
import { CompetitorCard } from "./src/components/CompetitorCard";
import { TimingScreen } from "./src/screens/TimingScreen";
import { VetGateScreen } from "./src/screens/VetGateScreen";
import {
  ParticipantStatus,
  TimeRecordType,
  UserRole,
} from "@equuscronos/shared";
import { AuthProvider, useAuth } from "./src/services/AuthContext";
import { LoginScreen } from "./src/screens/LoginScreen";
import { PermissionErrorScreen } from "./src/screens/PermissionErrorScreen";

type ScreenType = "LIST" | "TIMING" | "VET_GATE";

function MainApp() {
  const { user, logout, isLoading: authLoading } = useAuth();
  const [previousUser, setPreviousUser] = useState<any>(null);
  const [dbReady, setDbReady] = useState(false);
  const [entries, setEntries] = useState<LocalCompetitionEntry[]>([]);
  const [currentScreen, setCurrentScreen] = useState<ScreenType>("LIST");
  const [selectedEntry, setSelectedEntry] =
    useState<LocalCompetitionEntry | null>(null);
  const [stationRecordType, setStationRecordType] = useState<TimeRecordType>(
    TimeRecordType.ARRIVAL,
  );

  // Real-time synchronization states
  const [isOnline, setIsOnline] = useState(true);
  const [pendingSyncCount, setPendingSyncCount] = useState(0);

  // API URL configurations
  const [apiUrl, setApiUrl] = useState(ApiService.getBaseUrl());
  const updateApiUrl = (url: string) => {
    setApiUrl(url);
    ApiService.setBaseUrl(url);
  };
  const [isForceSyncing, setIsForceSyncing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  // Filtering state
  const [activeFilter, setActiveFilter] = useState<"ALL" | ParticipantStatus>(
    "ALL",
  );

  // Helper to import active competition entries, timing records and vet inspections into SQLite
  async function importActiveCompetitionData(
    activeCompetition: any,
    serverEntries: any[],
  ) {
    const db = await getDatabase();
    // Delete in reverse order of foreign key dependency
    await db.runAsync("DELETE FROM vet_inspections;");
    await db.runAsync("DELETE FROM timing_records;");
    await db.runAsync("DELETE FROM competition_entries;");

    const now = new Date().toISOString();

    for (const entry of serverEntries) {
      // Resolve stage ID with multiple fallbacks
      let currentStageId = entry.currentStage?.id;

      // Fallback 1: latest timing record stage ID
      if (
        !currentStageId &&
        entry.timingRecords &&
        entry.timingRecords.length > 0
      ) {
        const sortedRecords = [...entry.timingRecords].sort(
          (a, b) =>
            new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime(),
        );
        currentStageId =
          sortedRecords[0]?.stage?.id || sortedRecords[0]?.stageId;
      }

      // Fallback 2: first stage of the active competition
      if (!currentStageId) {
        const sortedStages = activeCompetition.stages
          ? [...activeCompetition.stages].sort(
              (a, b) => a.stageNumber - b.stageNumber,
            )
          : [];
        currentStageId = sortedStages[0]?.id || "";
      }

      await db.runAsync(
        `INSERT INTO competition_entries (
          id, tenant_id, competition_id, rider_id, rider_name, horse_id, horse_name, 
          bib_number, status, current_stage_id, ballast_weight, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
        [
          entry.id,
          entry.tenant?.id || "77777777-7777-7777-7777-777777777777",
          activeCompetition.id,
          entry.rider?.id || "rider-unknown",
          entry.rider?.name || "Desconocido",
          entry.horse?.id || "horse-unknown",
          entry.horse?.name || "Desconocido",
          entry.bibNumber,
          entry.status,
          currentStageId,
          Number(entry.ballastWeight) || 0,
          entry.createdAt || now,
          entry.updatedAt || now,
        ],
      );

      if (entry.timingRecords && Array.isArray(entry.timingRecords)) {
        for (const record of entry.timingRecords) {
          await db.runAsync(
            `INSERT INTO timing_records (
              id, tenant_id, entry_id, stage_id, record_type, recorded_at, 
              is_approved, elimination_type, elimination_reason, is_void, void_reason, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
            [
              record.id,
              record.tenant?.id ||
                entry.tenant?.id ||
                "77777777-7777-7777-7777-777777777777",
              entry.id,
              record.stage?.id || record.stageId || "",
              record.recordType,
              record.recordedAt,
              record.isApproved ? 1 : 0,
              record.eliminationType || null,
              record.eliminationReason || null,
              record.isVoid ? 1 : 0,
              record.voidReason || null,
              record.createdAt || now,
              record.updatedAt || now,
            ],
          );

          const vet = record.vetInspection;
          if (vet) {
            await db.runAsync(
              `INSERT INTO vet_inspections (
                id, tenant_id, timing_record_id, heart_rate, temperature, 
                motricity, metabolic, attempt_number, is_recheck_required, next_check_time, notes, created_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
              [
                vet.id,
                vet.tenant?.id ||
                  entry.tenant?.id ||
                  "77777777-7777-7777-7777-777777777777",
                record.id,
                vet.heartRate,
                vet.temperature !== undefined ? Number(vet.temperature) : null,
                vet.motricity,
                vet.metabolic,
                vet.attemptNumber || 1,
                vet.isRecheckRequired ? 1 : 0,
                vet.nextCheckTime || null,
                vet.notes || null,
                vet.createdAt || now,
              ],
            );
          }
        }
      }
    }
  }

  // Initialize DB and Listeners on App Mount
  useEffect(() => {
    async function setupApp() {
      try {
        // Bootstrapping local sqlite schema
        await initDatabase();
        setDbReady(true);
      } catch (error) {
        Alert.alert(
          "Falla Crítica",
          "No se pudo inicializar la base de datos interna SQLite.",
        );
      }
    }

    setupApp();

    // Attach Network state listener
    SyncService.registerStatusListener((connected) => {
      setIsOnline(connected);
    });

    // Attach Queue modification listener to keep diagnostic panel badge accurate
    SyncService.registerQueueListener(() => {
      updateQueueInfo();
    });

    // Initial queue assessment
    updateQueueInfo();
  }, []);

  // Load entries once db is ready
  useEffect(() => {
    if (dbReady) {
      reloadEntries();
    }
  }, [dbReady]);

  // Handle auto-import from server only when logged in and local DB is empty
  useEffect(() => {
    async function handleAutoImport() {
      if (!dbReady || !user) return;

      try {
        const db = await getDatabase();
        const rows = await db.getAllAsync<LocalCompetitionEntry>(
          "SELECT * FROM competition_entries ORDER BY bib_number ASC;",
        );

        if (rows.length === 0) {
          console.log(
            "[App] Local database is empty. Attempting automatic active competition import...",
          );
          setIsImporting(true);
          try {
            const competitions = await ApiService.fetchCompetitions();
            const activeCompetition = competitions.find(
              (c) => c.status === "ACTIVE",
            );

            if (activeCompetition) {
              const serverEntries = await ApiService.fetchLatestEntries(
                activeCompetition.id,
              );
              if (serverEntries.length > 0) {
                await importActiveCompetitionData(
                  activeCompetition,
                  serverEntries,
                );
                console.log(
                  `[App] Auto-imported active competition: ${activeCompetition.name}`,
                );
                await reloadEntries();
              }
            }
          } catch (autoImportErr) {
            console.warn(
              "[App] Auto-import of active competition failed (likely offline/unreachable):",
              autoImportErr,
            );
          } finally {
            setIsImporting(false);
          }
        }
      } catch (err) {
        console.warn("[App] Error in auto-import check:", err);
      }
    }

    handleAutoImport();
  }, [dbReady, user]);

  // Handle role-based redirect upon login
  useEffect(() => {
    if (user && !previousUser) {
      setPreviousUser(user);
      if (user.role === UserRole.VET) {
        setSelectedEntry(null);
        setCurrentScreen("VET_GATE");
      } else if (
        user.role === UserRole.TIMEKEEPER ||
        user.role === UserRole.JUDGE
      ) {
        setSelectedEntry(null);
        setCurrentScreen("TIMING");
      } else {
        setCurrentScreen("LIST");
      }
    } else if (!user) {
      setPreviousUser(null);
    }
  }, [user]);

  // Synchronize local apiUrl state when user logs in to prevent showing stale default IP
  useEffect(() => {
    if (user) {
      setApiUrl(ApiService.getBaseUrl());
    }
  }, [user]);

  const updateQueueInfo = async () => {
    const size = await SyncService.getQueueSize();
    setPendingSyncCount(size);
  };

  const reloadEntries = async () => {
    try {
      const db = await getDatabase();
      const rows = await db.getAllAsync<LocalCompetitionEntry>(
        "SELECT * FROM competition_entries ORDER BY bib_number ASC;",
      );
      setEntries(rows);
      await updateQueueInfo();
    } catch (e) {
      console.error("Failed to load entries:", e);
    }
  };

  const handleForceSync = async () => {
    if (!isOnline) {
      Alert.alert(
        "Offline",
        "Debe estar en línea para forzar la sincronización.",
      );
      return;
    }
    setIsForceSyncing(true);
    await SyncService.forceSync();
    await updateQueueInfo();
    setIsForceSyncing(false);
  };

  const handleImportActiveCompetition = async () => {
    if (!isOnline) {
      Alert.alert(
        "Offline",
        "Debe estar en línea para descargar datos del servidor.",
      );
      return;
    }

    if (pendingSyncCount > 0) {
      Alert.alert(
        "Acción Bloqueada",
        "Hay datos locales pendientes de sincronizar en la cola. Sincronícelos primero para evitar pérdida de información.",
      );
      return;
    }

    Alert.alert(
      "Descargar Competencia Activa",
      "¿Desea descargar y cargar los binomios de la competencia activa desde el servidor? Esto sobrescribirá la lista local.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Descargar",
          onPress: async () => {
            setIsImporting(true);
            try {
              const competitions = await ApiService.fetchCompetitions();
              const activeCompetition = competitions.find(
                (c) => c.status === "ACTIVE",
              );

              if (!activeCompetition) {
                Alert.alert(
                  "Aviso",
                  'No se encontró ninguna competencia en estado "ACTIVE" en el servidor.',
                );
                setIsImporting(false);
                return;
              }

              const serverEntries = await ApiService.fetchLatestEntries(
                activeCompetition.id,
              );

              if (serverEntries.length === 0) {
                Alert.alert(
                  "Aviso",
                  `La competencia "${activeCompetition.name}" no tiene competidores inscriptos.`,
                );
                setIsImporting(false);
                return;
              }

              await importActiveCompetitionData(
                activeCompetition,
                serverEntries,
              );

              Alert.alert(
                "Éxito",
                `Se importó correctamente la competencia:\n"${activeCompetition.name}"\n\nSe cargaron ${serverEntries.length} binomios y sus registros de tiempo locales.`,
              );
              await reloadEntries();
            } catch (error: any) {
              console.error("Error importing:", error);
              Alert.alert(
                "Error",
                `Ocurrió un error al descargar los competidores: ${error?.message || error}`,
              );
            } finally {
              setIsImporting(false);
            }
          },
        },
      ],
    );
  };

  const handleResetLocalDb = async () => {
    Alert.alert(
      "Restablecer Base de Datos",
      "¿Desea borrar toda la base de datos local y la cola de sincronización? Esta acción no se puede deshacer.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Restablecer",
          style: "destructive",
          onPress: async () => {
            try {
              const db = await getDatabase();
              await db.runAsync("DELETE FROM sync_queue;");
              // Delete in reverse order of foreign key dependency
              await db.runAsync("DELETE FROM vet_inspections;");
              await db.runAsync("DELETE FROM timing_records;");
              await db.runAsync("DELETE FROM competition_entries;");

              Alert.alert(
                "Éxito",
                "Base de datos local restablecida correctamente.",
              );
              await reloadEntries();
            } catch (e: any) {
              console.error("Failed to reset db:", e);
              Alert.alert(
                "Error",
                `No se pudo restablecer la base de datos: ${e?.message || e}`,
              );
            }
          },
        },
      ],
    );
  };

  // Filter local cache according to Judge filters
  const filteredEntries = entries.filter((entry) => {
    if (activeFilter === "ALL") return true;
    return entry.status === activeFilter;
  });

  // Navigation handlers
  const openTiming = (entry: LocalCompetitionEntry) => {
    setSelectedEntry(entry);
    setCurrentScreen("TIMING");
  };

  const openVet = (entry: LocalCompetitionEntry) => {
    setSelectedEntry(entry);
    setCurrentScreen("VET_GATE");
  };

  const handleBackToList = async () => {
    setSelectedEntry(null);
    setCurrentScreen("LIST");
    await reloadEntries(); // Refresh to catch local mutations
  };

  // Render Loading Splash
  if (!dbReady || authLoading) {
    return (
      <View style={styles.splashContainer}>
        <StatusBar style="dark" />
        <ActivityIndicator size="large" color={colors.equusGreen} />
        <Text style={styles.splashText}>EQUUSCRONOS</Text>
        <Text style={styles.splashSubtext}>
          {!dbReady
            ? "Iniciando base de datos SQLite local..."
            : "Cargando sesión..."}
        </Text>
      </View>
    );
  }

  // Render Login screen if not logged in
  if (!user) {
    return (
      <>
        <StatusBar style="light" backgroundColor="#0B1E14" />
        <LoginScreen />
      </>
    );
  }

  // Force screen redirects/guards based on role to block unauthorized navigation
  let activeScreen = currentScreen;
  if (user) {
    if (user.role === UserRole.VET) {
      activeScreen = "VET_GATE";
    } else if (
      user.role === UserRole.TIMEKEEPER ||
      user.role === UserRole.JUDGE
    ) {
      activeScreen = "TIMING";
    }
  }

  // Guard the rendering of screens based on role
  if (activeScreen === "TIMING") {
    const isAllowed =
      user.role === UserRole.ADMIN ||
      user.role === UserRole.TIMEKEEPER ||
      user.role === UserRole.JUDGE;
    if (!isAllowed) {
      return (
        <PermissionErrorScreen
          expectedRoles={[UserRole.ADMIN, UserRole.JUDGE, UserRole.TIMEKEEPER]}
          currentRole={user?.role}
          onBack={handleBackToList}
        />
      );
    }
  }

  if (activeScreen === "VET_GATE") {
    const isAllowed =
      user.role === UserRole.ADMIN || user.role === UserRole.VET;
    if (!isAllowed) {
      return (
        <PermissionErrorScreen
          expectedRoles={[UserRole.ADMIN, UserRole.VET]}
          currentRole={user?.role}
          onBack={handleBackToList}
        />
      );
    }
  }

  return (
    <SafeAreaView style={styles.safeContainer}>
      <StatusBar style="light" backgroundColor={colors.equusGreen} />

      {/* 1. BRAND HEADER & DIAGNOSTICS */}
      <View style={styles.brandHeader}>
        <View>
          <Text style={styles.headerTitle}>EQUUSCRONOS</Text>
          <Text style={styles.headerSubtitle}>
            Rol: {user.role} ({user.name})
          </Text>
        </View>

        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          {/* Connectivity Status Badge */}
          <View
            style={[
              styles.networkBadge,
              isOnline ? styles.badgeOnline : styles.badgeOffline,
            ]}
          >
            <View
              style={[
                styles.dot,
                { backgroundColor: isOnline ? "#10B981" : "#F59E0B" },
              ]}
            />
            <Text style={styles.networkText}>
              {isOnline ? "CONECTADO" : "SIN CONEXIÓN"}
            </Text>
          </View>

          {/* Logout Button */}
          <TouchableOpacity style={styles.logoutBtn} onPress={logout}>
            <Text style={styles.logoutBtnText}>Salir</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* API Configuration bar */}
      <View style={styles.apiConfigBar}>
        <Text style={styles.apiConfigLabel}>Servidor API:</Text>
        <TextInput
          style={[
            styles.apiInput,
            user.role !== UserRole.ADMIN && styles.apiInputDisabled,
          ]}
          value={apiUrl}
          onChangeText={updateApiUrl}
          placeholder="http://192.168.1.12:3000"
          placeholderTextColor="#64748B"
          autoCapitalize="none"
          autoCorrect={false}
          editable={user.role === UserRole.ADMIN}
        />
        {user.role !== UserRole.ADMIN && (
          <Text style={styles.apiLockedBadge}>🔒 Solo ADMIN</Text>
        )}
      </View>

      {/* 2. SYNC QUEUE UTILITY (Offline-First actions queue indicator) */}
      <View style={styles.syncPanel}>
        <View style={styles.syncInfo}>
          <Text style={styles.syncTitle}>Cola de Sincronización:</Text>
          <Text
            style={[
              styles.syncCount,
              pendingSyncCount > 0 && styles.syncCountActive,
            ]}
          >
            {pendingSyncCount === 0
              ? "Al día ✓"
              : `${pendingSyncCount} pendientes`}
          </Text>
        </View>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <TouchableOpacity
            style={styles.resetBtn}
            onPress={handleResetLocalDb}
          >
            <Text style={styles.syncBtnText}>Limpiar Base</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.importBtn, !isOnline && styles.syncBtnDisabled]}
            onPress={handleImportActiveCompetition}
            disabled={isImporting || !isOnline}
          >
            {isImporting ? (
              <ActivityIndicator size="small" color={colors.white} />
            ) : (
              <Text style={styles.syncBtnText}>Importar Servidor</Text>
            )}
          </TouchableOpacity>
          {pendingSyncCount > 0 && (
            <TouchableOpacity
              style={[styles.syncBtn, !isOnline && styles.syncBtnDisabled]}
              onPress={handleForceSync}
              disabled={isForceSyncing || !isOnline}
            >
              {isForceSyncing ? (
                <ActivityIndicator size="small" color={colors.white} />
              ) : (
                <Text style={styles.syncBtnText}>Sincronizar</Text>
              )}
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* 3. SCREEN NAVIGATOR */}
      {activeScreen === "LIST" && (
        <View style={styles.mainContent}>
          {/* Quick Timing Entry Stream Button */}
          {(user.role === UserRole.ADMIN ||
            user.role === UserRole.TIMEKEEPER ||
            user.role === UserRole.JUDGE) && (
            <TouchableOpacity
              style={styles.quickTimingBtn}
              onPress={() => {
                setSelectedEntry(null);
                setCurrentScreen("TIMING");
              }}
            >
              <Text style={styles.quickTimingBtnText}>
                ⏱️ Puesto{" "}
                {stationRecordType === "START"
                  ? "Largada"
                  : stationRecordType === "ARRIVAL"
                    ? "Arribos"
                    : stationRecordType === "VET_IN"
                      ? "Vet In"
                      : "Vet Out"}
                : Registrar (Stream)
              </Text>
            </TouchableOpacity>
          )}

          {/* Workstation Config Segment bar */}
          {(user.role === UserRole.ADMIN ||
            user.role === UserRole.TIMEKEEPER ||
            user.role === UserRole.JUDGE) && (
            <>
              <Text style={styles.sectionLabel}>PUESTO DE TRABAJO ACTIVO</Text>
              <View style={styles.stationConfigBar}>
                {(
                  Object.keys(TimeRecordType) as Array<
                    keyof typeof TimeRecordType
                  >
                )
                  .filter((key) => TimeRecordType[key] !== TimeRecordType.START)
                  .map((key) => {
                    const val = TimeRecordType[key];
                    const isActive = stationRecordType === val;
                    return (
                      <TouchableOpacity
                        key={val}
                        style={[
                          styles.stationBtn,
                          isActive && styles.stationBtnActive,
                        ]}
                        onPress={() => setStationRecordType(val)}
                      >
                        <Text
                          style={[
                            styles.stationText,
                            isActive && styles.stationTextActive,
                          ]}
                        >
                          {val === "ARRIVAL"
                            ? "🏁 Arribos"
                            : val === "VET_IN"
                              ? "🩺 Vet In"
                              : "🩺 Vet Out"}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
              </View>
            </>
          )}

          {/* Quick Filter Segment bar */}
          <Text style={styles.sectionLabel}>FILTRAR PARTICIPANTES</Text>
          <View style={styles.filterBar}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterScroll}
            >
              <TouchableOpacity
                style={[
                  styles.filterBtn,
                  activeFilter === "ALL" && styles.filterBtnActive,
                ]}
                onPress={() => setActiveFilter("ALL")}
              >
                <Text
                  style={[
                    styles.filterText,
                    activeFilter === "ALL" && styles.filterTextActive,
                  ]}
                >
                  Todos
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.filterBtn,
                  activeFilter === ParticipantStatus.IN_RACE &&
                    styles.filterBtnActive,
                ]}
                onPress={() => setActiveFilter(ParticipantStatus.IN_RACE)}
              >
                <Text
                  style={[
                    styles.filterText,
                    activeFilter === ParticipantStatus.IN_RACE &&
                      styles.filterTextActive,
                  ]}
                >
                  En Carrera
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.filterBtn,
                  activeFilter === ParticipantStatus.VET_CHECK &&
                    styles.filterBtnActive,
                ]}
                onPress={() => setActiveFilter(ParticipantStatus.VET_CHECK)}
              >
                <Text
                  style={[
                    styles.filterText,
                    activeFilter === ParticipantStatus.VET_CHECK &&
                      styles.filterTextActive,
                  ]}
                >
                  Mesa Vet
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.filterBtn,
                  activeFilter === ParticipantStatus.RESTING &&
                    styles.filterBtnActive,
                ]}
                onPress={() => setActiveFilter(ParticipantStatus.RESTING)}
              >
                <Text
                  style={[
                    styles.filterText,
                    activeFilter === ParticipantStatus.RESTING &&
                      styles.filterTextActive,
                  ]}
                >
                  Descanso
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.filterBtn,
                  activeFilter === ParticipantStatus.FINISHED &&
                    styles.filterBtnActive,
                ]}
                onPress={() => setActiveFilter(ParticipantStatus.FINISHED)}
              >
                <Text
                  style={[
                    styles.filterText,
                    activeFilter === ParticipantStatus.FINISHED &&
                      styles.filterTextActive,
                  ]}
                >
                  Meta
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.filterBtn,
                  activeFilter === ParticipantStatus.DQ &&
                    styles.filterBtnActive,
                ]}
                onPress={() => setActiveFilter(ParticipantStatus.DQ)}
              >
                <Text
                  style={[
                    styles.filterText,
                    activeFilter === ParticipantStatus.DQ &&
                      styles.filterTextActive,
                  ]}
                >
                  DQ
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>

          {/* Competitors List */}
          <FlatList
            data={filteredEntries}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContainer}
            renderItem={({ item }) => (
              <CompetitorCard
                entry={item}
                onPressTiming={openTiming}
                onPressVet={openVet}
                showTiming={
                  user.role === UserRole.ADMIN ||
                  user.role === UserRole.TIMEKEEPER ||
                  user.role === UserRole.JUDGE
                }
                showVet={
                  user.role === UserRole.ADMIN || user.role === UserRole.VET
                }
              />
            )}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>
                  Ningún binomio coincide con el filtro.
                </Text>
              </View>
            }
          />
        </View>
      )}

      {activeScreen === "TIMING" && (
        <TimingScreen
          entry={selectedEntry}
          stationRecordType={stationRecordType}
          onBack={handleBackToList}
          onRecordSuccess={handleBackToList}
        />
      )}

      {activeScreen === "VET_GATE" && (
        <VetGateScreen
          entry={selectedEntry}
          onBack={handleBackToList}
          onInspectionSuccess={handleBackToList}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  splashContainer: {
    flex: 1,
    backgroundColor: colors.equusBg,
    justifyContent: "center",
    alignItems: "center",
  },
  splashText: {
    fontSize: 24,
    fontWeight: "900",
    color: colors.equusGreen,
    marginTop: 16,
    letterSpacing: 2,
  },
  splashSubtext: {
    fontSize: 14,
    color: colors.muted,
    marginTop: 8,
  },
  safeContainer: {
    flex: 1,
    backgroundColor: colors.equusGreen, // Top safe area uses primary
  },
  brandHeader: {
    backgroundColor: colors.equusGreen,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 20,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  headerTitle: {
    color: colors.white,
    fontSize: 20,
    fontWeight: "900",
    letterSpacing: 1.5,
  },
  headerSubtitle: {
    color: colors.equusTanLight,
    fontSize: 12,
    fontWeight: "700",
    marginTop: 2,
  },
  networkBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
  },
  badgeOnline: {
    backgroundColor: "rgba(16, 185, 129, 0.15)",
  },
  badgeOffline: {
    backgroundColor: "rgba(245, 158, 11, 0.15)",
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  networkText: {
    fontSize: 10,
    fontWeight: "800",
    color: colors.white,
  },
  syncPanel: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#1E293B", // Slate gray panel for utilities
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  syncInfo: {
    flexDirection: "row",
    alignItems: "center",
  },
  syncTitle: {
    color: "#94A3B8",
    fontSize: 13,
    fontWeight: "600",
  },
  syncCount: {
    color: "#10B981",
    fontWeight: "800",
    fontSize: 13,
    marginLeft: 6,
  },
  syncCountActive: {
    color: "#F59E0B",
  },
  syncBtn: {
    backgroundColor: colors.equusGreen,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 4,
  },
  importBtn: {
    backgroundColor: "#3B82F6",
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 4,
  },
  resetBtn: {
    backgroundColor: "#EF4444",
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 4,
  },
  syncBtnDisabled: {
    backgroundColor: "#475569",
  },
  syncBtnText: {
    color: colors.white,
    fontSize: 11,
    fontWeight: "800",
  },
  mainContent: {
    flex: 1,
    backgroundColor: colors.equusBg,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: colors.muted,
    letterSpacing: 1.5,
    marginBottom: 8,
  },
  filterBar: {
    marginBottom: 10,
  },
  filterScroll: {
    gap: 8,
    paddingBottom: 4,
  },
  filterBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterBtnActive: {
    backgroundColor: colors.equusGreen,
    borderColor: colors.equusGreen,
  },
  filterText: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.equusText,
  },
  filterTextActive: {
    color: colors.white,
  },
  listContainer: {
    paddingBottom: 30,
  },
  emptyContainer: {
    paddingVertical: 40,
    alignItems: "center",
  },
  emptyText: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: "600",
  },
  quickTimingBtn: {
    backgroundColor: "#0F172A",
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#334155",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 4,
  },
  quickTimingBtnText: {
    color: "#38BDF8",
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  stationConfigBar: {
    flexDirection: "row",
    backgroundColor: "#1E293B",
    borderRadius: 10,
    padding: 4,
    marginBottom: 16,
    gap: 4,
  },
  stationBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    borderRadius: 8,
  },
  stationBtnActive: {
    backgroundColor: colors.equusGreen,
  },
  stationText: {
    color: "#94A3B8",
    fontSize: 12,
    fontWeight: "700",
  },
  stationTextActive: {
    color: colors.white,
    fontWeight: "800",
  },
  apiConfigBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#0F172A",
    paddingVertical: 6,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#1E293B",
  },
  apiConfigLabel: {
    color: "#94A3B8",
    fontSize: 11,
    fontWeight: "800",
    marginRight: 8,
    letterSpacing: 0.5,
  },
  apiInput: {
    flex: 1,
    color: colors.white,
    fontSize: 12,
    fontWeight: "600",
    paddingVertical: 2,
    paddingHorizontal: 8,
    backgroundColor: "#1E293B",
    borderRadius: 4,
  },
  apiInputDisabled: {
    backgroundColor: "#0F172A",
    color: "#64748B",
  },
  apiLockedBadge: {
    color: "#EF4444",
    fontSize: 10,
    fontWeight: "800",
    marginLeft: 8,
    letterSpacing: 0.5,
  },
  logoutBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: "#991B1B",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#B91C1C",
  },
  logoutBtnText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "800",
  },
});

export default function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}
