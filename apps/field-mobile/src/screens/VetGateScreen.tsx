import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TextInput, 
  TouchableOpacity, 
  Alert,
  ActivityIndicator
} from 'react-native';
import { LocalCompetitionEntry } from '../database/schema';
import { colors } from '../theme/colors';
import { Button } from '../components/Button';
import { getDatabase } from '../database/db';
import SyncService from '../services/SyncService';
import { ValidationService } from '../services/ValidationService';
import { 
  MotricityStatus, 
  ClinicalStatus, 
  ParticipantStatus, 
  TimeRecordType, 
  EliminationCode 
} from '@equuscronos/shared';

interface VetGateScreenProps {
  entry: LocalCompetitionEntry;
  onBack: () => void;
  onInspectionSuccess: () => void;
}

export const VetGateScreen: React.FC<VetGateScreenProps> = ({
  entry,
  onBack,
  onInspectionSuccess
}) => {
  const [heartRate, setHeartRate] = useState<string>('');
  const [temperature, setTemperature] = useState<string>('38.2');
  const [motricity, setMotricity] = useState<MotricityStatus>(MotricityStatus.APTO);
  const [metabolic, setMetabolic] = useState<ClinicalStatus>(ClinicalStatus.NORMAL);
  const [attempt, setAttempt] = useState<number>(1);
  const [notes, setNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // States for logical sequence and read-only inspection history
  const [loading, setLoading] = useState(true);
  const [inspections, setInspections] = useState<any[]>([]);
  const [isReadOnly, setIsReadOnly] = useState(false);
  const [recheckAllowed, setRecheckAllowed] = useState(false);

  // FEU physiological standard
  const HEART_RATE_LIMIT = 56; 

  const parsedHr = parseInt(heartRate, 10);
  const parsedTemp = parseFloat(temperature);

  // Dynamic visual indicators of FEU regulatory threshold
  const isHeartRateWarning = !isNaN(parsedHr) && parsedHr > HEART_RATE_LIMIT;
  const isGaitWarning = motricity === MotricityStatus.NOT_APTO;
  const isEliminationWarning = isGaitWarning || (isHeartRateWarning && attempt === 2);

  const loadInspections = async () => {
    try {
      const db = await getDatabase();
      const rows = await db.getAllAsync<any>(
        `SELECT tr.id as timing_record_id, vi.id as vet_inspection_id, vi.heart_rate, vi.temperature, vi.motricity, vi.metabolic, vi.attempt_number, vi.is_recheck_required, vi.notes
         FROM timing_records tr
         LEFT JOIN vet_inspections vi ON vi.timing_record_id = tr.id
         WHERE tr.entry_id = ? AND tr.stage_id = ? AND tr.record_type = 'VET_IN' AND tr.is_void = 0
         ORDER BY vi.attempt_number ASC;`,
        [entry.id, entry.current_stage_id]
      );

      setInspections(rows);

      if (rows.length === 0) {
        // Ningún intento registrado
        setAttempt(1);
        setRecheckAllowed(false);
        setIsReadOnly(false);
      } else if (rows.length === 1) {
        const first = rows[0];
        if (first.is_recheck_required === 1) {
          // El primero requiere rechequeo. Habilitar intento 2.
          setRecheckAllowed(true);
          setAttempt(2); // Por defecto mostrar intento 2 para ingresar
          setIsReadOnly(false);
        } else {
          // Finalizado. Mostrar intento 1 en modo lectura.
          setRecheckAllowed(false);
          setAttempt(1);
          setIsReadOnly(true);
          // Cargar valores
          setHeartRate(String(first.heart_rate || ''));
          setTemperature(String(first.temperature || ''));
          setMotricity(first.motricity || MotricityStatus.APTO);
          setMetabolic(first.metabolic || ClinicalStatus.NORMAL);
          setNotes(first.notes || '');
        }
      } else {
        // Dos intentos registrados. Finalizado.
        setRecheckAllowed(true);
        setAttempt(2); // Por defecto mostrar el último intento (2)
        setIsReadOnly(true);
        const second = rows[1];
        setHeartRate(String(second.heart_rate || ''));
        setTemperature(String(second.temperature || ''));
        setMotricity(second.motricity || MotricityStatus.APTO);
        setMetabolic(second.metabolic || ClinicalStatus.NORMAL);
        setNotes(second.notes || '');
      }
    } catch (e) {
      console.error('[VetGateScreen] Error loading inspections:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInspections();
  }, [entry.id, entry.current_stage_id]);

  const handleAttemptChange = (num: number) => {
    if (num === 1) {
      const first = inspections.find(ins => ins.attempt_number === 1);
      if (first) {
        setHeartRate(String(first.heart_rate || ''));
        setTemperature(String(first.temperature || ''));
        setMotricity(first.motricity || MotricityStatus.APTO);
        setMetabolic(first.metabolic || ClinicalStatus.NORMAL);
        setNotes(first.notes || '');
        setIsReadOnly(true);
      } else {
        setHeartRate('');
        setTemperature('38.2');
        setMotricity(MotricityStatus.APTO);
        setMetabolic(ClinicalStatus.NORMAL);
        setNotes('');
        setIsReadOnly(false);
      }
      setAttempt(1);
    } else if (num === 2) {
      const second = inspections.find(ins => ins.attempt_number === 2);
      if (second) {
        setHeartRate(String(second.heart_rate || ''));
        setTemperature(String(second.temperature || ''));
        setMotricity(second.motricity || MotricityStatus.APTO);
        setMetabolic(second.metabolic || ClinicalStatus.NORMAL);
        setNotes(second.notes || '');
        setIsReadOnly(true);
      } else {
        setHeartRate('');
        setTemperature('38.2');
        setMotricity(MotricityStatus.APTO);
        setMetabolic(ClinicalStatus.NORMAL);
        setNotes('');
        setIsReadOnly(false);
      }
      setAttempt(2);
    }
  };

  const handleSubmit = async () => {
    if (isReadOnly) return;

    if (!heartRate || isNaN(parsedHr)) {
      Alert.alert('Datos requeridos', 'Por favor, ingrese una frecuencia cardíaca válida.');
      return;
    }

    setIsSubmitting(true);
    const now = new Date().toISOString();
    
    // UUIDs
    const timingId = `tr-vet-${Date.now()}`;
    const vetId = `vet-${Date.now()}`;
    
    const tenantId = entry.tenant_id;
    const stageId = entry.current_stage_id;

    try {
      const db = await getDatabase();

      // Consultar el arribo para validar la barrera de 20 minutos
      const arrivalRecord = await db.getFirstAsync<any>(
        `SELECT recorded_at FROM timing_records WHERE entry_id = ? AND stage_id = ? AND record_type = 'ARRIVAL' AND is_void = 0;`,
        [entry.id, stageId]
      );

      let arrivalTime: Date | null = null;
      if (arrivalRecord && arrivalRecord.recorded_at) {
        arrivalTime = new Date(arrivalRecord.recorded_at);
      }

      const presentationTime = new Date(now);
      const diffMs = arrivalTime ? (presentationTime.getTime() - arrivalTime.getTime()) : 0;
      const diffMinutes = Math.round(diffMs / (1000 * 60));

      // Decision Logic under FEU Regulations
      let targetStatus = ParticipantStatus.RESTING;
      let isApproved = 1;
      let eliminationType: EliminationCode | null = null;
      let eliminationReason = null;
      let isRecheckRequired = 0;

      if (arrivalTime && diffMs > 20 * 60 * 1000) {
        // Fuera de tiempo de recuperación (Barrera del minuto 20 - Art. 31 FEU)
        targetStatus = ParticipantStatus.DQ;
        isApproved = 0;
        eliminationType = EliminationCode.FTQ;
        eliminationReason = `Fuera de tiempo de recuperación: ${diffMinutes} minutos (Límite: 20 min).`;
      } else if (motricity === MotricityStatus.NOT_APTO) {
        // Gait Lameness -> Direct DQ
        targetStatus = ParticipantStatus.DQ;
        isApproved = 0;
        eliminationType = EliminationCode.GAIT;
        eliminationReason = 'Cojera / Claudicación detectada en mesa veterinaria.';
      } else if (parsedHr > HEART_RATE_LIMIT) {
        if (attempt === 1) {
          // High pulse attempt 1 -> mark for recheck
          targetStatus = ParticipantStatus.VET_CHECK;
          isRecheckRequired = 1;
        } else {
          // High pulse attempt 2 -> Metabolic elimination
          targetStatus = ParticipantStatus.DQ;
          isApproved = 0;
          eliminationType = EliminationCode.METABOLIC;
          eliminationReason = `Frecuencia cardíaca excedida (${parsedHr} ppm) tras el segundo intento en Vet Gate. Límite: ${HEART_RATE_LIMIT} ppm.`;
        }
      }

      // 0. Validar secuencia e idempotencia del nuevo VET_IN en SQLite
      const valResult = await ValidationService.validateTimingRecord(
        db,
        entry.id,
        stageId,
        TimeRecordType.VET_IN
      );

      if (!valResult.isValid) {
        Alert.alert(
          'Validación de Secuencia',
          valResult.error || 'Operación denegada por reglas FEU.'
        );
        setIsSubmitting(false);
        return;
      }

      // 1. Write VET_IN Timing Record locally
      await db.runAsync(
        `INSERT INTO timing_records (
          id, tenant_id, entry_id, stage_id, record_type, recorded_at, is_approved, elimination_type, elimination_reason, is_void, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?);`,
        [
          timingId,
          tenantId,
          entry.id,
          stageId,
          TimeRecordType.VET_IN,
          now,
          isApproved,
          eliminationType || null,
          eliminationReason || null,
          now,
          now
        ]
      );

      // 2. Write Detailed Clinical Metrics locally
      await db.runAsync(
        `INSERT INTO vet_inspections (
          id, tenant_id, timing_record_id, heart_rate, temperature, motricity, metabolic, attempt_number, is_recheck_required, notes, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
        [
          vetId,
          tenantId,
          timingId,
          parsedHr,
          isNaN(parsedTemp) ? null : parsedTemp,
          motricity,
          metabolic,
          attempt,
          isRecheckRequired,
          notes || null,
          now
        ]
      );

      // 3. Update Participant Status locally
      await db.runAsync(
        `UPDATE competition_entries SET status = ?, updated_at = ? WHERE id = ?;`,
        [targetStatus, now, entry.id]
      );

      console.log('[SQLite] Local database updated with vet inspection metrics.');

      // 4. Enqueue to Offline Sync Queue (Postgres mapping)
      const isOnline = SyncService.isOnline();

      // Enqueue timing record
      await SyncService.enqueueAction('CREATE_TIMING', 'timing_records', {
        id: timingId,
        tenant_id: tenantId,
        entry_id: entry.id,
        stage_id: stageId,
        record_type: TimeRecordType.VET_IN,
        recorded_at: now,
        is_approved: isApproved,
        elimination_type: eliminationType,
        elimination_reason: eliminationReason,
        is_void: 0,
        created_at: now,
        updated_at: now
      });

      // Enqueue vet inspection details
      await SyncService.enqueueAction('CREATE_VET_INSPECTION', 'vet_inspections', {
        id: vetId,
        tenant_id: tenantId,
        timing_record_id: timingId,
        heart_rate: parsedHr,
        temperature: isNaN(parsedTemp) ? null : parsedTemp,
        motricity: motricity,
        metabolic: metabolic,
        attempt_number: attempt,
        is_recheck_required: isRecheckRequired,
        notes: notes || '',
        created_at: now
      });

      // Enqueue entry status mutation
      await SyncService.enqueueAction('UPDATE_ENTRY_STATUS', 'competition_entries', {
        id: entry.id,
        status: targetStatus
      });

      // User Alert feedback
      let statusHeading = 'Inspección Aprobada';
      let statusDetails = `Caballo apto. Pasa a neutralización (Resting).`;
      if (isRecheckRequired === 1) {
        statusHeading = 'Rechequeo Requerido';
        statusDetails = `El pulso superó los ${HEART_RATE_LIMIT} ppm. Se requiere re-evaluar al caballo antes del tiempo límite.`;
      } else if (targetStatus === ParticipantStatus.DQ) {
        statusHeading = '🛑 ELIMINACIÓN REGLAMENTARIA';
        statusDetails = eliminationType === EliminationCode.GAIT 
          ? 'Descalificado por Claudicación (Cojera).' 
          : `Descalificado por Falla Metabólica (${parsedHr} ppm en Intento 2).`;
      }

      const syncMsg = isOnline 
        ? 'Sincronizado con el servidor.' 
        : 'Almacenado localmente en la cola offline.';

      Alert.alert(
        statusHeading,
        `Bib #${entry.bib_number}\nFrecuencia: ${parsedHr} ppm\n\n${statusDetails}\n\n${syncMsg}`,
        [{ text: 'Entendido', onPress: onInspectionSuccess }]
      );

    } catch (e) {
      console.error('[VetGate] Error saving inspection:', e);
      Alert.alert('Error', 'Ocurrió un error al guardar la inspección localmente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={colors.equusGreen} />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <Text style={styles.backText}> Volver</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Mesa Veterinaria</Text>
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

      {/* Read-Only Status Banner */}
      {isReadOnly && (
        <View style={styles.infoAlertBanner}>
          <Text style={styles.infoAlertTitle}>ℹ️ INSPECCIÓN FINALIZADA</Text>
          <Text style={styles.infoAlertText}>
            Inspección finalizada. No se permiten rechequeos.
          </Text>
        </View>
      )}

      {/* FEU Warning Alert */}
      {!isReadOnly && isEliminationWarning && (
        <View style={styles.dangerAlertBanner}>
          <Text style={styles.dangerAlertTitle}>🛑 ELIMINACIÓN REGLAMENTARIA FEU</Text>
          <Text style={styles.dangerAlertText}>
            {isGaitWarning 
              ? 'La claudicación es motivo de descalificación directa.' 
              : `Pulso metabólico (${parsedHr} ppm) supera el límite en el segundo intento.`}
          </Text>
        </View>
      )}

      {!isReadOnly && isHeartRateWarning && attempt === 1 && (
        <View style={styles.warningAlertBanner}>
          <Text style={styles.warningAlertTitle}>⚠️ PULSO ELEVADO (INTENTO 1)</Text>
          <Text style={styles.warningAlertText}>
            Pulso ({parsedHr} ppm) &gt; {HEART_RATE_LIMIT}. El binomio tiene una oportunidad de rechequeo dentro del límite de tiempo.
          </Text>
        </View>
      )}

      {/* Parameters Entry Card */}
      <View style={styles.inputCard}>
        <Text style={styles.cardSectionTitle}>PARÁMETROS CLÍNICOS</Text>
        
        {/* Heart Rate */}
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Frecuencia Cardíaca (ppm)</Text>
          <TextInput
            style={[styles.numericInput, isHeartRateWarning && styles.inputWarningBorder]}
            placeholder="Ej: 52"
            keyboardType="numeric"
            value={heartRate}
            onChangeText={setHeartRate}
            maxLength={3}
            editable={!isReadOnly}
          />
        </View>

        {/* Temperature */}
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Temperatura (°C)</Text>
          <TextInput
            style={styles.numericInput}
            placeholder="Ej: 38.2"
            keyboardType="numeric"
            value={temperature}
            onChangeText={setTemperature}
            maxLength={4}
            editable={!isReadOnly}
          />
        </View>

        {/* Attempt Number Selector */}
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Número de Intento (FEU)</Text>
          <View style={styles.segmentSelector}>
            {[1, 2].map((num) => {
              const isDisabled = num === 2 && !recheckAllowed;
              return (
                <TouchableOpacity
                  key={num}
                  style={[
                    styles.segmentBtn, 
                    attempt === num && styles.segmentBtnActive,
                    isDisabled && { opacity: 0.4 }
                  ]}
                  onPress={() => {
                    if (isDisabled) {
                      Alert.alert(
                        'Acción Denegada',
                        'El Intento 2 solo se habilita si el Intento 1 requiere rechequeo (pulso superado).'
                      );
                      return;
                    }
                    handleAttemptChange(num);
                  }}
                >
                  <Text style={[styles.segmentText, attempt === num && styles.segmentTextActive]}>
                    Intento {num}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </View>

      {/* Statuses Card */}
      <View style={styles.inputCard}>
        <Text style={styles.cardSectionTitle}>EVALUACIÓN FISIOLÓGICA</Text>

        {/* Motricity (Claudicación) */}
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Motricidad / Marcha</Text>
          <View style={styles.segmentSelector}>
            {(Object.keys(MotricityStatus) as Array<keyof typeof MotricityStatus>).map((key) => {
              const val = MotricityStatus[key];
              const isSelected = motricity === val;
              return (
                <TouchableOpacity
                  key={val}
                  style={[
                    styles.segmentBtn, 
                    isSelected && val === 'APTO' && { backgroundColor: colors.success },
                    isSelected && val === 'NOT_APTO' && { backgroundColor: colors.danger }
                  ]}
                  onPress={() => {
                    if (isReadOnly) return;
                    setMotricity(val);
                  }}
                >
                  <Text style={[styles.segmentText, isSelected && { color: colors.white }]}>
                    {val === 'APTO' ? '🟢 APTO' : '🔴 NO APTO (Cojera)'}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Metabolic Status */}
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Estado Metabólico</Text>
          <View style={styles.segmentSelector}>
            {(Object.keys(ClinicalStatus) as Array<keyof typeof ClinicalStatus>).map((key) => {
              const val = ClinicalStatus[key];
              const isSelected = metabolic === val;
              return (
                <TouchableOpacity
                  key={val}
                  style={[
                    styles.segmentBtn, 
                    isSelected && val === 'NORMAL' && { backgroundColor: colors.success },
                    isSelected && val === 'COMPROMISED' && { backgroundColor: colors.warning },
                    isSelected && val === 'CRITICAL' && { backgroundColor: colors.danger }
                  ]}
                  onPress={() => {
                    if (isReadOnly) return;
                    setMetabolic(val);
                  }}
                >
                  <Text style={[styles.segmentText, isSelected && { color: colors.white }]}>
                    {val}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Notes */}
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Notas de Inspección</Text>
          <TextInput
            style={styles.textArea}
            placeholder="Ingrese observaciones sobre hidratación, mucosas, etc..."
            multiline
            numberOfLines={4}
            value={notes}
            onChangeText={setNotes}
            editable={!isReadOnly}
          />
        </View>
      </View>

      {/* Actions */}
      <View style={styles.submitContainer}>
        <Button 
          title="🩺 REGISTRAR INSPECCIÓN VETERINARIA"
          variant={isEliminationWarning ? 'danger' : 'primary'}
          isLoading={isSubmitting}
          onPress={handleSubmit}
          disabled={isReadOnly || isSubmitting}
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
  dangerAlertBanner: {
    backgroundColor: '#FEE2E2',
    borderWidth: 2,
    borderColor: colors.danger,
    borderRadius: 8,
    padding: 14,
    marginBottom: 16,
  },
  dangerAlertTitle: {
    color: '#991B1B',
    fontWeight: '900',
    fontSize: 14,
    marginBottom: 4,
  },
  dangerAlertText: {
    color: '#7F1D1D',
    fontSize: 13,
    fontWeight: '700',
  },
  warningAlertBanner: {
    backgroundColor: '#FEF3C7',
    borderWidth: 2,
    borderColor: colors.warning,
    borderRadius: 8,
    padding: 14,
    marginBottom: 16,
  },
  warningAlertTitle: {
    color: '#92400E',
    fontWeight: '900',
    fontSize: 14,
    marginBottom: 4,
  },
  warningAlertText: {
    color: '#78350F',
    fontSize: 13,
    fontWeight: '700',
  },
  infoAlertBanner: {
    backgroundColor: '#E0F2FE',
    borderWidth: 2,
    borderColor: '#0284C7',
    borderRadius: 8,
    padding: 14,
    marginBottom: 16,
  },
  infoAlertTitle: {
    color: '#0369A1',
    fontWeight: '900',
    fontSize: 14,
    marginBottom: 4,
  },
  infoAlertText: {
    color: '#0C4A6E',
    fontSize: 13,
    fontWeight: '700',
  },
  inputCard: {
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 16,
  },
  cardSectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.muted,
    letterSpacing: 1,
    marginBottom: 12,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.equusText,
    marginBottom: 8,
  },
  numericInput: {
    height: 50,
    backgroundColor: colors.inputBg,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 16,
    fontSize: 18,
    fontWeight: '700',
    color: colors.equusText,
  },
  inputWarningBorder: {
    borderColor: colors.danger,
    borderWidth: 1.5,
    backgroundColor: '#FFF5F5',
  },
  segmentSelector: {
    flexDirection: 'row',
    gap: 8,
  },
  segmentBtn: {
    flex: 1,
    height: 46,
    backgroundColor: colors.inputBg,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  segmentBtnActive: {
    backgroundColor: colors.equusGreen,
    borderColor: colors.equusGreen,
  },
  segmentText: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.equusText,
  },
  segmentTextActive: {
    color: colors.white,
  },
  textArea: {
    backgroundColor: colors.inputBg,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    fontSize: 14,
    color: colors.equusText,
    textAlignVertical: 'top',
  },
  submitContainer: {
    gap: 4,
    marginBottom: 30,
  },
});
