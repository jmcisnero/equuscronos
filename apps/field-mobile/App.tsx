import React, { useState, useEffect } from 'react';
import { 
  SafeAreaView, 
  StyleSheet, 
  Text, 
  View, 
  FlatList, 
  ActivityIndicator, 
  TouchableOpacity, 
  Alert,
  ScrollView
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { colors } from './src/theme/colors';
import { initDatabase, getDatabase } from './src/database/db';
import { LocalCompetitionEntry } from './src/database/schema';
import SyncService from './src/services/SyncService';
import { CompetitorCard } from './src/components/CompetitorCard';
import { TimingScreen } from './src/screens/TimingScreen';
import { VetGateScreen } from './src/screens/VetGateScreen';
import { ParticipantStatus } from '@equuscronos/shared';

type ScreenType = 'LIST' | 'TIMING' | 'VET_GATE';

export default function App() {
  const [dbReady, setDbReady] = useState(false);
  const [entries, setEntries] = useState<LocalCompetitionEntry[]>([]);
  const [currentScreen, setCurrentScreen] = useState<ScreenType>('LIST');
  const [selectedEntry, setSelectedEntry] = useState<LocalCompetitionEntry | null>(null);
  
  // Real-time synchronization states
  const [isOnline, setIsOnline] = useState(true);
  const [pendingSyncCount, setPendingSyncCount] = useState(0);
  const [isForceSyncing, setIsForceSyncing] = useState(false);
  
  // Filtering state
  const [activeFilter, setActiveFilter] = useState<'ALL' | ParticipantStatus>('ALL');

  // Initialize DB and Listeners on App Mount
  useEffect(() => {
    async function setupApp() {
      try {
        // Bootstrapping local sqlite schema and seeding high-quality records
        await initDatabase();
        setDbReady(true);
        await reloadEntries();
      } catch (error) {
        Alert.alert('Falla Crítica', 'No se pudo inicializar la base de datos interna SQLite.');
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

  const updateQueueInfo = async () => {
    const size = await SyncService.getQueueSize();
    setPendingSyncCount(size);
  };

  const reloadEntries = async () => {
    try {
      const db = await getDatabase();
      const rows = await db.getAllAsync<LocalCompetitionEntry>(
        'SELECT * FROM competition_entries ORDER BY bib_number ASC;'
      );
      setEntries(rows);
      await updateQueueInfo();
    } catch (e) {
      console.error('Failed to load entries:', e);
    }
  };

  const handleForceSync = async () => {
    if (!isOnline) {
      Alert.alert('Offline', 'Debe estar en línea para forzar la sincronización.');
      return;
    }
    setIsForceSyncing(true);
    await SyncService.forceSync();
    await updateQueueInfo();
    setIsForceSyncing(false);
  };

  // Filter local cache according to Judge filters
  const filteredEntries = entries.filter(entry => {
    if (activeFilter === 'ALL') return true;
    return entry.status === activeFilter;
  });

  // Navigation handlers
  const openTiming = (entry: LocalCompetitionEntry) => {
    setSelectedEntry(entry);
    setCurrentScreen('TIMING');
  };

  const openVet = (entry: LocalCompetitionEntry) => {
    setSelectedEntry(entry);
    setCurrentScreen('VET_GATE');
  };

  const handleBackToList = async () => {
    setSelectedEntry(null);
    setCurrentScreen('LIST');
    await reloadEntries(); // Refresh to catch local mutations
  };

  // Render Loading Splash
  if (!dbReady) {
    return (
      <View style={styles.splashContainer}>
        <StatusBar style="dark" />
        <ActivityIndicator size="large" color={colors.equusGreen} />
        <Text style={styles.splashText}>EQUUSCRONOS</Text>
        <Text style={styles.splashSubtext}>Iniciando base de datos SQLite local...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeContainer}>
      <StatusBar style="light" backgroundColor={colors.equusGreen} />
      
      {/* 1. BRAND HEADER & DIAGNOSTICS */}
      <View style={styles.brandHeader}>
        <View>
          <Text style={styles.headerTitle}>EQUUSCRONOS</Text>
          <Text style={styles.headerSubtitle}>Field Mobile v1.0.0</Text>
        </View>

        {/* Connectivity Status Badge */}
        <View style={[styles.networkBadge, isOnline ? styles.badgeOnline : styles.badgeOffline]}>
          <View style={[styles.dot, { backgroundColor: isOnline ? '#10B981' : '#F59E0B' }]} />
          <Text style={styles.networkText}>{isOnline ? 'CONECTADO' : 'SIN CONEXIÓN'}</Text>
        </View>
      </View>

      {/* 2. SYNC QUEUE UTILITY (Offline-First actions queue indicator) */}
      <View style={styles.syncPanel}>
        <View style={styles.syncInfo}>
          <Text style={styles.syncTitle}>Cola de Sincronización:</Text>
          <Text style={[styles.syncCount, pendingSyncCount > 0 && styles.syncCountActive]}>
            {pendingSyncCount === 0 ? 'Al día ✓' : `${pendingSyncCount} pendientes`}
          </Text>
        </View>
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

      {/* 3. SCREEN NAVIGATOR */}
      {currentScreen === 'LIST' && (
        <View style={styles.mainContent}>
          {/* Quick Filter Segment bar */}
          <Text style={styles.sectionLabel}>FILTRAR PARTICIPANTES</Text>
          <View style={styles.filterBar}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
              <TouchableOpacity 
                style={[styles.filterBtn, activeFilter === 'ALL' && styles.filterBtnActive]}
                onPress={() => setActiveFilter('ALL')}
              >
                <Text style={[styles.filterText, activeFilter === 'ALL' && styles.filterTextActive]}>Todos</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.filterBtn, activeFilter === ParticipantStatus.IN_RACE && styles.filterBtnActive]}
                onPress={() => setActiveFilter(ParticipantStatus.IN_RACE)}
              >
                <Text style={[styles.filterText, activeFilter === ParticipantStatus.IN_RACE && styles.filterTextActive]}>En Carrera</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.filterBtn, activeFilter === ParticipantStatus.VET_CHECK && styles.filterBtnActive]}
                onPress={() => setActiveFilter(ParticipantStatus.VET_CHECK)}
              >
                <Text style={[styles.filterText, activeFilter === ParticipantStatus.VET_CHECK && styles.filterTextActive]}>Mesa Vet</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.filterBtn, activeFilter === ParticipantStatus.RESTING && styles.filterBtnActive]}
                onPress={() => setActiveFilter(ParticipantStatus.RESTING)}
              >
                <Text style={[styles.filterText, activeFilter === ParticipantStatus.RESTING && styles.filterTextActive]}>Descanso</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.filterBtn, activeFilter === ParticipantStatus.FINISHED && styles.filterBtnActive]}
                onPress={() => setActiveFilter(ParticipantStatus.FINISHED)}
              >
                <Text style={[styles.filterText, activeFilter === ParticipantStatus.FINISHED && styles.filterTextActive]}>Meta</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.filterBtn, activeFilter === ParticipantStatus.DQ && styles.filterBtnActive]}
                onPress={() => setActiveFilter(ParticipantStatus.DQ)}
              >
                <Text style={[styles.filterText, activeFilter === ParticipantStatus.DQ && styles.filterTextActive]}>DQ</Text>
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
              />
            )}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>Ningún binomio coincide con el filtro.</Text>
              </View>
            }
          />
        </View>
      )}

      {currentScreen === 'TIMING' && selectedEntry && (
        <TimingScreen 
          entry={selectedEntry}
          onBack={handleBackToList}
          onRecordSuccess={handleBackToList}
        />
      )}

      {currentScreen === 'VET_GATE' && selectedEntry && (
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
    justifyContent: 'center',
    alignItems: 'center',
  },
  splashText: {
    fontSize: 24,
    fontWeight: '900',
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    color: colors.white,
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  headerSubtitle: {
    color: colors.equusTanLight,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 2,
  },
  networkBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
  },
  badgeOnline: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
  },
  badgeOffline: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  networkText: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.white,
  },
  syncPanel: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1E293B', // Slate gray panel for utilities
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  syncInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  syncTitle: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '600',
  },
  syncCount: {
    color: '#10B981',
    fontWeight: '800',
    fontSize: 13,
    marginLeft: 6,
  },
  syncCountActive: {
    color: '#F59E0B',
  },
  syncBtn: {
    backgroundColor: colors.equusGreen,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 4,
  },
  syncBtnDisabled: {
    backgroundColor: '#475569',
  },
  syncBtnText: {
    color: colors.white,
    fontSize: 11,
    fontWeight: '800',
  },
  mainContent: {
    flex: 1,
    backgroundColor: colors.equusBg,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '800',
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
    fontWeight: '700',
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
    alignItems: 'center',
  },
  emptyText: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: '600',
  },
});
