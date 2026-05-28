import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, TouchableOpacity } from 'react-native';
import { LocalCompetitionEntry } from '../database/schema';
import { colors } from '../theme/colors';
import { Button } from '../components/Button';
import { getDatabase } from '../database/db';
import SyncService from '../services/SyncService';
import { TimeRecordType, ParticipantStatus } from '@equuscronos/shared';

interface TimingScreenProps {
  entry: LocalCompetitionEntry;
  onBack: () => void;
  onRecordSuccess: () => void;
}

export const TimingScreen: React.FC<TimingScreenProps> = ({
  entry,
  onBack,
  onRecordSuccess
}) => {
  const [recordType, setRecordType] = useState<TimeRecordType>(TimeRecordType.START);
  const [timeSource, setTimeSource] = useState<'SYSTEM' | 'MANUAL'>('SYSTEM');
  const [systemTime, setSystemTime] = useState<Date>(new Date());
  const [manualOffsetSeconds, setManualOffsetSeconds] = useState<number>(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Tick the clock every 50ms for high-precision timekeeping
  useEffect(() => {
    const timer = setInterval(() => {
      setSystemTime(new Date());
    }, 50);
    return () => clearInterval(timer);
  }, []);

  const getTargetTime = (): Date => {
    if (timeSource === 'SYSTEM') return systemTime;
    // Add custom offset if manual adjustment is selected
    return new Date(systemTime.getTime() + manualOffsetSeconds * 1000);
  };

  const handleRecordTime = async () => {
    setIsSubmitting(true);
    const recordedAt = getTargetTime().toISOString();
    const recordId = `tr-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const tenantId = entry.tenant_id;
    const stageId = entry.current_stage_id;

    // Determine target competitor status depending on TimeRecordType
    let targetStatus = entry.status;
    if (recordType === TimeRecordType.START) {
      targetStatus = ParticipantStatus.IN_RACE;
    } else if (recordType === TimeRecordType.ARRIVAL) {
      targetStatus = ParticipantStatus.VET_CHECK;
    } else if (recordType === TimeRecordType.VET_IN) {
      targetStatus = ParticipantStatus.VET_CHECK;
    } else if (recordType === TimeRecordType.VET_OUT) {
      targetStatus = ParticipantStatus.RESTING;
    }

    try {
      const db = await getDatabase();

      // 1. Transactionally write to SQLite local tables (Source of truth)
      await db.runAsync(
        `INSERT INTO timing_records (
          id, tenant_id, entry_id, stage_id, record_type, recorded_at, is_approved, is_void, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, 1, 0, ?, ?);`,
        [recordId, tenantId, entry.id, stageId, recordType, recordedAt, recordedAt, recordedAt]
      );

      await db.runAsync(
        `UPDATE competition_entries SET status = ?, updated_at = ? WHERE id = ?;`,
        [targetStatus, recordedAt, entry.id]
      );

      console.log(`[SQLite] Local database updated. Entry: ${entry.id}, Status: ${targetStatus}`);

      // 2. Queue actions for Backend Synchronization (Postgres)
      const isOnline = SyncService.isOnline();
      
      // Enqueue timing record creation
      await SyncService.enqueueAction('CREATE_TIMING', 'timing_records', {
        id: recordId,
        tenant_id: tenantId,
        entry_id: entry.id,
        stage_id: stageId,
        record_type: recordType,
        recorded_at: recordedAt,
        is_approved: 1,
        is_void: 0,
        created_at: recordedAt,
        updated_at: recordedAt
      });

      // Enqueue entry status mutation
      await SyncService.enqueueAction('UPDATE_ENTRY_STATUS', 'competition_entries', {
        id: entry.id,
        status: targetStatus
      });

      // Show friendly confirmation dialog
      const syncMsg = isOnline 
        ? 'Sincronizado con el servidor exitosamente.' 
        : 'Guardado localmente. Se sincronizará automáticamente al recuperar conexión.';

      Alert.alert(
        'Tiempo Registrado',
        `Bib #${entry.bib_number}\nEvento: ${recordType}\nHora: ${getTargetTime().toLocaleTimeString()}\n\n${syncMsg}`,
        [{ text: 'OK', onPress: onRecordSuccess }]
      );

    } catch (error) {
      console.error('[Timing] Write failed:', error);
      Alert.alert('Error', 'No se pudo guardar el registro local en la base de datos.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const formattedTime = (date: Date): string => {
    const hh = String(date.getHours()).padStart(2, '0');
    const mm = String(date.getMinutes()).padStart(2, '0');
    const ss = String(date.getSeconds()).padStart(2, '0');
    const ms = String(Math.floor(date.getMilliseconds() / 100)).padStart(1, '0');
    return `${hh}:${mm}:${ss}.${ms}`;
  };

  const adjustOffset = (amount: number) => {
    setTimeSource('MANUAL');
    setManualOffsetSeconds(prev => prev + amount);
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <Text style={styles.backText}>⬅️ Volver</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Toma de Tiempos</Text>
      </View>

      {/* Competitor Banner */}
      <View style={styles.competitorCard}>
        <Text style={styles.bibLabel}>BICICLETA / BIB</Text>
        <Text style={styles.bibNumber}>#{entry.bib_number}</Text>
        <Text style={styles.riderName}>{entry.rider_name}</Text>
        <Text style={styles.horseName}>🐴 {entry.horse_name}</Text>
        <View style={styles.statusRow}>
          <Text style={styles.statusLabel}>Estado Actual:</Text>
          <Text style={styles.statusValue}>{entry.status}</Text>
        </View>
      </View>

      {/* Master Chronometer */}
      <View style={styles.chronoContainer}>
        <Text style={styles.chronoTitle}>RELOJ DE COMPETENCIA (SISTEMA)</Text>
        <Text style={styles.chronoDigits}>
          {formattedTime(getTargetTime())}
        </Text>
        <View style={styles.sourceSelector}>
          <TouchableOpacity 
            style={[styles.sourceBtn, timeSource === 'SYSTEM' && styles.sourceBtnActive]}
            onPress={() => { setTimeSource('SYSTEM'); setManualOffsetSeconds(0); }}
          >
            <Text style={[styles.sourceText, timeSource === 'SYSTEM' && styles.sourceTextActive]}>
              Hora Automática
            </Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.sourceBtn, timeSource === 'MANUAL' && styles.sourceBtnActive]}
            onPress={() => setTimeSource('MANUAL')}
          >
            <Text style={[styles.sourceText, timeSource === 'MANUAL' && styles.sourceTextActive]}>
              Ajuste Manual
            </Text>
          </TouchableOpacity>
        </View>

        {timeSource === 'MANUAL' && (
          <View style={styles.manualControls}>
            <TouchableOpacity style={styles.offsetBtn} onPress={() => adjustOffset(-60)}>
              <Text style={styles.offsetBtnText}>-1m</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.offsetBtn} onPress={() => adjustOffset(-1)}>
              <Text style={styles.offsetBtnText}>-1s</Text>
            </TouchableOpacity>
            <Text style={styles.offsetValue}>
              {manualOffsetSeconds > 0 ? `+${manualOffsetSeconds}s` : `${manualOffsetSeconds}s`}
            </Text>
            <TouchableOpacity style={styles.offsetBtn} onPress={() => adjustOffset(1)}>
              <Text style={styles.offsetBtnText}>+1s</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.offsetBtn} onPress={() => adjustOffset(60)}>
              <Text style={styles.offsetBtnText}>+1m</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Event Selectors */}
      <View style={styles.eventCard}>
        <Text style={styles.cardSectionTitle}>TIPO DE EVENTO CRONOMETRADO</Text>
        <View style={styles.eventGrid}>
          {(Object.keys(TimeRecordType) as Array<keyof typeof TimeRecordType>).map((key) => {
            const val = TimeRecordType[key];
            const isActive = recordType === val;
            return (
              <TouchableOpacity
                key={val}
                style={[styles.eventBtn, isActive && styles.eventBtnActive]}
                onPress={() => setRecordType(val)}
              >
                <Text style={[styles.eventBtnText, isActive && styles.eventBtnTextActive]}>
                  {val === 'START' ? '🏁 START' :
                   val === 'ARRIVAL' ? '🏁 ARRIVAL' :
                   val === 'VET_IN' ? '🩺 VET IN' :
                   '🩺 VET OUT'}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Actions */}
      <View style={styles.submitContainer}>
        <Button 
          title="⏱️ Registrar Marca de Tiempo"
          variant="success"
          isLoading={isSubmitting}
          onPress={handleRecordTime}
        />
        <Button 
          title="Cancelar"
          variant="outline"
          onPress={onBack}
        />
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 20,
    backgroundColor: colors.equusBg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  backButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: colors.white,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: 16,
  },
  backText: {
    fontWeight: '700',
    color: colors.equusText,
  },
  title: {
    fontSize: 22,
    fontWeight: '900',
    color: colors.equusGreen,
  },
  competitorCard: {
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 16,
  },
  bibLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.muted,
  },
  bibNumber: {
    fontSize: 28,
    fontWeight: '900',
    color: colors.equusGreen,
  },
  riderName: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.equusText,
    marginTop: 4,
  },
  horseName: {
    fontSize: 15,
    color: colors.muted,
    marginTop: 2,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderColor: '#F1F5F9',
  },
  statusLabel: {
    fontSize: 13,
    color: colors.muted,
    marginRight: 6,
  },
  statusValue: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.equusGreen,
  },
  chronoContainer: {
    backgroundColor: '#0F172A', // Deep slate for high contrast
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    marginBottom: 16,
  },
  chronoTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.equusTanLight,
    letterSpacing: 1.5,
    marginBottom: 8,
  },
  chronoDigits: {
    fontSize: 40,
    fontFamily: 'monospace',
    fontWeight: '900',
    color: '#38BDF8', // Cyan light digits
    letterSpacing: 2,
    marginBottom: 16,
  },
  sourceSelector: {
    flexDirection: 'row',
    backgroundColor: '#1E293B',
    borderRadius: 8,
    padding: 4,
  },
  sourceBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  sourceBtnActive: {
    backgroundColor: colors.equusGreen,
  },
  sourceText: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '700',
  },
  sourceTextActive: {
    color: colors.white,
  },
  manualControls: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    gap: 8,
  },
  offsetBtn: {
    backgroundColor: '#334155',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  offsetBtnText: {
    color: colors.white,
    fontWeight: '800',
  },
  offsetValue: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '700',
    minWidth: 50,
    textAlign: 'center',
  },
  eventCard: {
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 20,
  },
  cardSectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.muted,
    letterSpacing: 1,
    marginBottom: 12,
  },
  eventGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  eventBtn: {
    flex: 1,
    minWidth: '45%',
    height: 50,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  eventBtnActive: {
    backgroundColor: colors.equusGreen,
    borderColor: colors.equusGreen,
  },
  eventBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.equusText,
  },
  eventBtnTextActive: {
    color: colors.white,
  },
  submitContainer: {
    gap: 4,
    marginBottom: 30,
  },
});
