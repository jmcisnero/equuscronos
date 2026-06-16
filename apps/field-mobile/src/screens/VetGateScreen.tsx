import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from "react-native";
import { LocalCompetitionEntry } from "../database/schema";
import { colors } from "../theme/colors";
import { Button } from "../components/Button";
import { getDatabase } from "../database/db";
import SyncService from "../services/SyncService";
import { useAuth } from "../services/AuthContext";
import {
  MotricityStatus,
  ClinicalStatus,
  ParticipantStatus,
  TimeRecordType,
  EliminationCode,
  UserRole,
} from "@equuscronos/shared";

interface VetGateScreenProps {
  entry: LocalCompetitionEntry | null;
  onBack?: () => void;
  onInspectionSuccess: () => void;
}

export const VetGateScreen: React.FC<VetGateScreenProps> = ({
  entry,
  onBack,
  onInspectionSuccess,
}) => {
  const { user } = useAuth();
  const searchInputRef = useRef<TextInput>(null);

  // Search & matching states
  const [bibSearch, setBibSearch] = useState(
    entry ? entry.bib_number.toString() : "",
  );
  const [matchedEntry, setMatchedEntry] =
    useState<LocalCompetitionEntry | null>(entry || null);

  // Clinical parameters states
  const [heartRate, setHeartRate] = useState<string>("");
  const [temperature, setTemperature] = useState<string>("38.2");
  const [motricity, setMotricity] = useState<MotricityStatus>(
    MotricityStatus.APTO,
  );
  const [metabolic, setMetabolic] = useState<ClinicalStatus>(
    ClinicalStatus.NORMAL,
  );
  const [attempt, setAttempt] = useState<number>(1);
  const [notes, setNotes] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // States for logical sequence and read-only inspection history
  const [loading, setLoading] = useState(false);
  const [inspections, setInspections] = useState<any[]>([]);
  const [isReadOnly, setIsReadOnly] = useState(false);
  const [recheckAllowed, setRecheckAllowed] = useState(false);

  // Verification & block states
  const [isEnabled, setIsEnabled] = useState(false);
  const [blockMessage, setBlockMessage] = useState("");
  const [vetInRecord, setVetInRecord] = useState<any | null>(null);

  // Focus search input on screen mount
  useEffect(() => {
    const focusTimer = setTimeout(() => {
      searchInputRef.current?.focus();
    }, 200);
    return () => clearTimeout(focusTimer);
  }, []);

  // FEU physiological standard
  const HEART_RATE_LIMIT = 65;

  const parsedHr = parseInt(heartRate, 10);
  const parsedTemp = parseFloat(temperature);

  // Dynamic visual indicators of FEU regulatory threshold
  const isHeartRateWarning = !isNaN(parsedHr) && parsedHr > HEART_RATE_LIMIT;
  const isGaitWarning = motricity === MotricityStatus.NOT_APTO;
  const isEliminationWarning =
    isGaitWarning || (isHeartRateWarning && attempt === 2);

  // Real-time lookup of competitor as bib number changes
  useEffect(() => {
    const lookupBib = async () => {
      const trimmed = bibSearch.trim();
      if (!trimmed) {
        setMatchedEntry(null);
        return;
      }
      const bibInt = parseInt(trimmed, 10);
      if (isNaN(bibInt)) {
        setMatchedEntry(null);
        return;
      }
      try {
        const db = await getDatabase();
        const found = await db.getFirstAsync<LocalCompetitionEntry>(
          "SELECT * FROM competition_entries WHERE bib_number = ?;",
          [bibInt],
        );
        setMatchedEntry(found || null);
      } catch (e) {
        console.error("[VetGateScreen] Database lookup error:", e);
        setMatchedEntry(null);
      }
    };

    lookupBib();
  }, [bibSearch]);

  const loadEntryState = async () => {
    if (!matchedEntry) {
      setIsEnabled(false);
      setBlockMessage("Seleccione o ingrese un dorsal para comenzar.");
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const db = await getDatabase();
      const rows = await db.getAllAsync<any>(
        `SELECT tr.id as timing_record_id, tr.is_approved, tr.recorded_at, vi.id as vet_inspection_id, vi.heart_rate, vi.temperature, vi.motricity, vi.metabolic, vi.attempt_number, vi.is_recheck_required, vi.notes
         FROM timing_records tr
         LEFT JOIN vet_inspections vi ON vi.timing_record_id = tr.id
         WHERE tr.entry_id = ? AND tr.stage_id = ? AND tr.record_type = 'VET_IN' AND tr.is_void = 0
         ORDER BY vi.attempt_number ASC;`,
        [matchedEntry.id, matchedEntry.current_stage_id],
      );

      setInspections(rows);

      // Check if disqualified
      if (
        matchedEntry.status === ParticipantStatus.DQ ||
        matchedEntry.status === ParticipantStatus.DNF ||
        matchedEntry.status === ParticipantStatus.WD
      ) {
        setIsEnabled(false);
        setBlockMessage(
          "Binomio no habilitado para chequeo clínico: se encuentra fuera de competencia (DQ/DNF/WD).",
        );
        setLoading(false);
        return;
      }

      // Check if VET_IN milestone exists
      if (rows.length === 0) {
        setIsEnabled(false);
        setBlockMessage(
          "Binomio no habilitado para chequeo clínico: no registra entrada a veterinaria (VET_IN).",
        );
        setLoading(false);
        return;
      }

      // Check if VET_IN was unapproved (exceeded recovery time limit)
      const unapprovedVetIn = rows.find((r) => r.is_approved === 0);
      if (unapprovedVetIn) {
        setIsEnabled(false);
        setBlockMessage(
          "Binomio no habilitado para chequeo clínico: el ingreso a veterinaria no fue aprobado (excedió tiempo de recuperación).",
        );
        setLoading(false);
        return;
      }

      // We have VET_IN milestone(s).
      // Find the VET_IN record that does NOT have a vet inspection yet.
      const nextInspectionRecord = rows.find(
        (r) => r.vet_inspection_id === null,
      );

      if (nextInspectionRecord) {
        // We have a VET_IN record ready to be clinical-checked!
        setVetInRecord(nextInspectionRecord);
        setIsEnabled(true);
        setBlockMessage("");
        setIsReadOnly(false);

        // If there's 1 existing inspection which requires recheck, then this is attempt 2
        const firstInspection = rows.find((r) => r.attempt_number === 1);
        if (firstInspection && firstInspection.is_recheck_required === 1) {
          setAttempt(2);
          setRecheckAllowed(true);
        } else {
          setAttempt(1);
          setRecheckAllowed(false);
        }

        // Clear inputs for editing
        setHeartRate("");
        setTemperature("38.2");
        setMotricity(MotricityStatus.APTO);
        setMetabolic(ClinicalStatus.NORMAL);
        setNotes("");
      } else {
        // All VET_IN records have inspections completed
        setIsEnabled(true); // Enabled in read-only mode to show results!
        setBlockMessage("");
        setIsReadOnly(true);

        // Load the last inspection details
        const last = rows[rows.length - 1];
        setVetInRecord(last);
        setAttempt(last.attempt_number || 1);
        setHeartRate(String(last.heart_rate || ""));
        setTemperature(String(last.temperature || ""));
        setMotricity(last.motricity || MotricityStatus.APTO);
        setMetabolic(last.metabolic || ClinicalStatus.NORMAL);
        setNotes(last.notes || "");

        const firstInspection = rows.find((r) => r.attempt_number === 1);
        if (firstInspection && firstInspection.is_recheck_required === 1) {
          setRecheckAllowed(true);
        } else {
          setRecheckAllowed(false);
        }
      }
    } catch (e) {
      console.error("[VetGateScreen] Error loading entry state:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEntryState();
  }, [matchedEntry?.id, matchedEntry?.current_stage_id]);

  const handleAttemptChange = (num: number) => {
    if (num === 1) {
      const first = inspections.find((ins) => ins.attempt_number === 1);
      if (first) {
        setHeartRate(String(first.heart_rate || ""));
        setTemperature(String(first.temperature || ""));
        setMotricity(first.motricity || MotricityStatus.APTO);
        setMetabolic(first.metabolic || ClinicalStatus.NORMAL);
        setNotes(first.notes || "");
        setIsReadOnly(true);
      } else {
        setHeartRate("");
        setTemperature("38.2");
        setMotricity(MotricityStatus.APTO);
        setMetabolic(ClinicalStatus.NORMAL);
        setNotes("");
        setIsReadOnly(false);
      }
      setAttempt(1);
    } else if (num === 2) {
      const second = inspections.find((ins) => ins.attempt_number === 2);
      if (second) {
        setHeartRate(String(second.heart_rate || ""));
        setTemperature(String(second.temperature || ""));
        setMotricity(second.motricity || MotricityStatus.APTO);
        setMetabolic(second.metabolic || ClinicalStatus.NORMAL);
        setNotes(second.notes || "");
        setIsReadOnly(true);
      } else {
        setHeartRate("");
        setTemperature("38.2");
        setMotricity(MotricityStatus.APTO);
        setMetabolic(ClinicalStatus.NORMAL);
        setNotes("");
        setIsReadOnly(false);
      }
      setAttempt(2);
    }
  };

  const handleSubmit = async () => {
    if (isReadOnly || !isEnabled || !matchedEntry || !vetInRecord) return;

    if (!heartRate || isNaN(parsedHr)) {
      Alert.alert(
        "Datos requeridos",
        "Por favor, ingrese una frecuencia cardíaca válida.",
      );
      return;
    }

    setIsSubmitting(true);
    const now = new Date().toISOString();
    const vetId = `vet-${Date.now()}`;

    const tenantId = matchedEntry.tenant_id;
    const stageId = matchedEntry.current_stage_id;

    try {
      const db = await getDatabase();

      // Consultar el arribo para validar la barrera de 20 minutos
      const arrivalRecord = await db.getFirstAsync<any>(
        `SELECT recorded_at FROM timing_records WHERE entry_id = ? AND stage_id = ? AND record_type = 'ARRIVAL' AND is_void = 0;`,
        [matchedEntry.id, stageId],
      );

      let arrivalTime: Date | null = null;
      if (arrivalRecord && arrivalRecord.recorded_at) {
        arrivalTime = new Date(arrivalRecord.recorded_at);
      }

      const presentationTime = new Date(vetInRecord.recorded_at);
      const diffMs = arrivalTime
        ? presentationTime.getTime() - arrivalTime.getTime()
        : 0;
      const diffMinutes = Math.round(diffMs / (1000 * 60));

      let targetStatus = ParticipantStatus.RESTING;
      let isApproved = 1;
      let eliminationType: EliminationCode | null = null;
      let eliminationReason = null;
      let isRecheckRequired = 0;

      if (arrivalTime && diffMs > 20 * 60 * 1000) {
        // Fuera de tiempo de recuperación (Barrera del minuto 20 - Art. 31 FEU)
        targetStatus = ParticipantStatus.DQ;
        isApproved = 0;
        eliminationType = EliminationCode.TIME;
        eliminationReason = `Fuera de tiempo de recuperación: ${diffMinutes} minutos (Límite: 20 min).`;
      } else if (motricity === MotricityStatus.NOT_APTO) {
        // Gait Lameness -> Direct DQ
        targetStatus = ParticipantStatus.DQ;
        isApproved = 0;
        eliminationType = EliminationCode.GAIT;
        eliminationReason =
          "Cojera / Claudicación detectada en mesa veterinaria.";
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

      // 1. Update timing_records locally
      await db.runAsync(
        `UPDATE timing_records
         SET is_approved = ?, elimination_type = ?, elimination_reason = ?, updated_at = ?
         WHERE id = ?;`,
        [
          isApproved,
          eliminationType || null,
          eliminationReason || null,
          now,
          vetInRecord.timing_record_id,
        ],
      );

      // 2. Write Detailed Clinical Metrics locally
      await db.runAsync(
        `INSERT INTO vet_inspections (
          id, tenant_id, timing_record_id, heart_rate, temperature, motricity, metabolic, attempt_number, is_recheck_required, notes, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
        [
          vetId,
          tenantId,
          vetInRecord.timing_record_id,
          parsedHr,
          isNaN(parsedTemp) ? null : parsedTemp,
          motricity,
          metabolic,
          attempt,
          isRecheckRequired,
          notes || null,
          now,
        ],
      );

      // 3. Update Participant Status locally
      await db.runAsync(
        `UPDATE competition_entries SET status = ?, updated_at = ? WHERE id = ?;`,
        [targetStatus, now, matchedEntry.id],
      );

      console.log(
        "[SQLite] Local database updated with vet inspection metrics.",
      );

      // 4. Enqueue actions for synchronization
      const isOnline = SyncService.isOnline();

      // Enqueue the updated timing record status (to ensure the server timing record matches local status)
      await SyncService.enqueueAction("UPDATE_TIMING", "timing_records", {
        id: vetInRecord.timing_record_id,
        recordedAt: vetInRecord.recorded_at, // Just reuse recorded_at, the backend will update timing record isApproved, eliminationType, eliminationReason when processing CREATE_VET_INSPECTION. But enqueuing this ensures database structure triggers.
      });

      // Enqueue vet inspection details
      await SyncService.enqueueAction(
        "CREATE_VET_INSPECTION",
        "vet_inspections",
        {
          id: vetId,
          tenant_id: tenantId,
          timing_record_id: vetInRecord.timing_record_id,
          heart_rate: parsedHr,
          temperature: isNaN(parsedTemp) ? null : parsedTemp,
          motricity: motricity,
          metabolic: metabolic,
          attempt_number: attempt,
          is_recheck_required: isRecheckRequired,
          notes: notes || "",
          created_at: now,
        },
      );

      // Enqueue entry status update
      await SyncService.enqueueAction(
        "UPDATE_ENTRY_STATUS",
        "competition_entries",
        {
          id: matchedEntry.id,
          status: targetStatus,
        },
      );

      // User Alert feedback
      let statusHeading = "Inspección Aprobada";
      let statusDetails = `Caballo apto. Pasa a neutralización (Resting).`;
      if (isRecheckRequired === 1) {
        statusHeading = "Rechequeo Requerido";
        statusDetails = `El pulso superó los ${HEART_RATE_LIMIT} ppm. Se requiere re-evaluar al caballo antes del tiempo límite.`;
      } else if (targetStatus === ParticipantStatus.DQ) {
        statusHeading = "🛑 ELIMINACIÓN REGLAMENTARIA";
        statusDetails =
          eliminationType === EliminationCode.GAIT
            ? "Descalificado por Claudicación (Cojera)."
            : eliminationType === EliminationCode.TIME
              ? `Fuera de tiempo de recuperación (${diffMinutes} min).`
              : `Descalificado por Falla Metabólica (${parsedHr} ppm en Intento 2).`;
      }

      const syncMsg = isOnline
        ? "Sincronizado con el servidor."
        : "Almacenado localmente en la cola offline.";

      Alert.alert(
        statusHeading,
        `Bib #${matchedEntry.bib_number}\nFrecuencia: ${parsedHr} ppm\n\n${statusDetails}\n\n${syncMsg}`,
        [
          {
            text: "Entendido",
            onPress: () => {
              setBibSearch("");
              setMatchedEntry(null);
              setHeartRate("");
              setTemperature("38.2");
              setMotricity(MotricityStatus.APTO);
              setMetabolic(ClinicalStatus.NORMAL);
              setNotes("");

              if (onInspectionSuccess) {
                onInspectionSuccess();
              }
              loadEntryState();

              setTimeout(() => {
                searchInputRef.current?.focus();
              }, 150);
            },
          },
        ],
      );
    } catch (e) {
      console.error("[VetGate] Error saving inspection:", e);
      Alert.alert(
        "Error",
        "Ocurrió un error al guardar la inspección localmente.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View
        style={[
          styles.container,
          { justifyContent: "center", alignItems: "center", flex: 1 },
        ]}
      >
        <ActivityIndicator size="large" color={colors.equusGreen} />
      </View>
    );
  }

  const showBackButton = onBack && user?.role !== UserRole.VET;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        {showBackButton && (
          <TouchableOpacity style={styles.backButton} onPress={onBack}>
            <Text style={styles.backText}> Volver</Text>
          </TouchableOpacity>
        )}
        <Text style={styles.title}>Mesa Veterinaria</Text>
      </View>

      {/* Search Bar for Veterinarian */}
      {(!entry || user?.role === UserRole.VET) && (
        <View style={styles.searchCard}>
          <Text style={styles.inputLabel}>Buscar Dorsal / Bib</Text>
          <TextInput
            ref={searchInputRef}
            style={styles.searchInput}
            placeholder="Ingrese número de dorsal (ej. 12)"
            placeholderTextColor="#64748B"
            keyboardType="numeric"
            value={bibSearch}
            onChangeText={setBibSearch}
          />
        </View>
      )}

      {/* Competitor Banner */}
      {matchedEntry ? (
        <View style={styles.competitorCard}>
          <Text style={styles.bibLabel}>BICICLETA / BIB</Text>
          <Text style={styles.bibNumber}>#{matchedEntry.bib_number}</Text>
          <Text style={styles.riderName}>{matchedEntry.rider_name}</Text>
          <Text style={styles.horseName}>🐴 {matchedEntry.horse_name}</Text>
          <View style={styles.statusRow}>
            <Text style={styles.statusLabel}>Estado Actual:</Text>
            <Text style={styles.statusValue}>{matchedEntry.status}</Text>
          </View>
        </View>
      ) : (
        <View style={styles.emptySearchCard}>
          <Text style={styles.emptySearchText}>
            {bibSearch
              ? "No se encontró ningún binomio con ese dorsal."
              : "Ingrese un número de dorsal para comenzar."}
          </Text>
        </View>
      )}

      {/* Block Cartel if not enabled */}
      {matchedEntry && !isEnabled && (
        <View style={styles.blockedBanner}>
          <Text style={styles.blockedTitle}>⚠️ ACCIÓN BLOQUEADA</Text>
          <Text style={styles.blockedText}>
            {blockMessage || "Binomio no habilitado para chequeo clínico"}
          </Text>
        </View>
      )}

      {/* Clinical Form fields - only render if enabled */}
      {matchedEntry && isEnabled && (
        <>
          {/* Read-Only Status Banner */}
          {isReadOnly && (
            <View style={styles.infoAlertBanner}>
              <Text style={styles.infoAlertTitle}>
                ℹ️ INSPECCIÓN FINALIZADA
              </Text>
              <Text style={styles.infoAlertText}>
                Inspección finalizada. No se permiten rechequeos o
                modificaciones.
              </Text>
            </View>
          )}

          {/* FEU Warning Alert */}
          {!isReadOnly && isEliminationWarning && (
            <View style={styles.dangerAlertBanner}>
              <Text style={styles.dangerAlertTitle}>
                🛑 ELIMINACIÓN REGLAMENTARIA FEU
              </Text>
              <Text style={styles.dangerAlertText}>
                {isGaitWarning
                  ? "La claudicación es motivo de descalificación directa."
                  : `Pulso metabólico (${parsedHr} ppm) supera el límite en el segundo intento.`}
              </Text>
            </View>
          )}

          {!isReadOnly && isHeartRateWarning && attempt === 1 && (
            <View style={styles.warningAlertBanner}>
              <Text style={styles.warningAlertTitle}>
                ⚠️ PULSO ELEVADO (INTENTO 1)
              </Text>
              <Text style={styles.warningAlertText}>
                Pulso ({parsedHr} ppm) &gt; {HEART_RATE_LIMIT}. El binomio tiene
                una oportunidad de rechequeo dentro del límite de tiempo.
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
                style={[
                  styles.numericInput,
                  isHeartRateWarning && styles.inputWarningBorder,
                ]}
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
                        isDisabled && { opacity: 0.4 },
                      ]}
                      onPress={() => {
                        if (isDisabled) {
                          Alert.alert(
                            "Acción Denegada",
                            "El Intento 2 solo se habilita si el Intento 1 requiere rechequeo (pulso superado).",
                          );
                          return;
                        }
                        handleAttemptChange(num);
                      }}
                    >
                      <Text
                        style={[
                          styles.segmentText,
                          attempt === num && styles.segmentTextActive,
                        ]}
                      >
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
                {(
                  Object.keys(MotricityStatus) as Array<
                    keyof typeof MotricityStatus
                  >
                ).map((key) => {
                  const val = MotricityStatus[key];
                  const isSelected = motricity === val;
                  return (
                    <TouchableOpacity
                      key={val}
                      style={[
                        styles.segmentBtn,
                        isSelected &&
                          val === "APTO" && { backgroundColor: colors.success },
                        isSelected &&
                          val === "NOT_APTO" && {
                            backgroundColor: colors.danger,
                          },
                      ]}
                      onPress={() => {
                        if (isReadOnly) return;
                        setMotricity(val);
                      }}
                    >
                      <Text
                        style={[
                          styles.segmentText,
                          isSelected && { color: colors.white },
                        ]}
                      >
                        {val === "APTO" ? "🟢 APTO" : "🔴 NO APTO (Cojera)"}
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
                {(
                  Object.keys(ClinicalStatus) as Array<
                    keyof typeof ClinicalStatus
                  >
                ).map((key) => {
                  const val = ClinicalStatus[key];
                  const isSelected = metabolic === val;
                  return (
                    <TouchableOpacity
                      key={val}
                      style={[
                        styles.segmentBtn,
                        isSelected &&
                          val === "NORMAL" && {
                            backgroundColor: colors.success,
                          },
                        isSelected &&
                          val === "COMPROMISED" && {
                            backgroundColor: colors.warning,
                          },
                        isSelected &&
                          val === "CRITICAL" && {
                            backgroundColor: colors.danger,
                          },
                      ]}
                      onPress={() => {
                        if (isReadOnly) return;
                        setMetabolic(val);
                      }}
                    >
                      <Text
                        style={[
                          styles.segmentText,
                          isSelected && { color: colors.white },
                        ]}
                      >
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
              title="🩺 FINALIZAR INSPECCIÓN"
              variant={isEliminationWarning ? "danger" : "primary"}
              isLoading={isSubmitting}
              onPress={handleSubmit}
              disabled={isReadOnly || isSubmitting}
            />
            {showBackButton && (
              <Button title="Cancelar" variant="outline" onPress={onBack} />
            )}
          </View>
        </>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 20,
    backgroundColor: colors.equusBg,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
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
    fontWeight: "700",
    color: colors.equusText,
  },
  title: {
    fontSize: 22,
    fontWeight: "900",
    color: colors.equusGreen,
  },
  searchCard: {
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 16,
  },
  searchInput: {
    height: 50,
    backgroundColor: colors.inputBg,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 16,
    fontSize: 16,
    fontWeight: "700",
    color: colors.equusText,
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
    fontWeight: "800",
    color: colors.muted,
  },
  bibNumber: {
    fontSize: 28,
    fontWeight: "900",
    color: colors.equusGreen,
  },
  riderName: {
    fontSize: 18,
    fontWeight: "800",
    color: colors.equusText,
    marginTop: 4,
  },
  horseName: {
    fontSize: 15,
    color: colors.muted,
    marginTop: 2,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderColor: "#F1F5F9",
  },
  statusLabel: {
    fontSize: 13,
    color: colors.muted,
    marginRight: 6,
  },
  statusValue: {
    fontSize: 14,
    fontWeight: "800",
    color: colors.equusGreen,
  },
  emptySearchCard: {
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 24,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    marginBottom: 16,
  },
  emptySearchText: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: "600",
    textAlign: "center",
  },
  blockedBanner: {
    backgroundColor: "#FEF2F2",
    borderWidth: 2,
    borderColor: "#EF4444",
    borderRadius: 12,
    padding: 20,
    alignItems: "center",
    marginBottom: 16,
  },
  blockedTitle: {
    color: "#991B1B",
    fontWeight: "900",
    fontSize: 16,
    marginBottom: 6,
  },
  blockedText: {
    color: "#7F1D1D",
    fontSize: 14,
    fontWeight: "800",
    textAlign: "center",
  },
  dangerAlertBanner: {
    backgroundColor: "#FEE2E2",
    borderWidth: 2,
    borderColor: colors.danger,
    borderRadius: 8,
    padding: 14,
    marginBottom: 16,
  },
  dangerAlertTitle: {
    color: "#991B1B",
    fontWeight: "900",
    fontSize: 14,
    marginBottom: 4,
  },
  dangerAlertText: {
    color: "#7F1D1D",
    fontSize: 13,
    fontWeight: "700",
  },
  warningAlertBanner: {
    backgroundColor: "#FEF3C7",
    borderWidth: 2,
    borderColor: colors.warning,
    borderRadius: 8,
    padding: 14,
    marginBottom: 16,
  },
  warningAlertTitle: {
    color: "#92400E",
    fontWeight: "900",
    fontSize: 14,
    marginBottom: 4,
  },
  warningAlertText: {
    color: "#78350F",
    fontSize: 13,
    fontWeight: "700",
  },
  infoAlertBanner: {
    backgroundColor: "#E0F2FE",
    borderWidth: 2,
    borderColor: "#0284C7",
    borderRadius: 8,
    padding: 14,
    marginBottom: 16,
  },
  infoAlertTitle: {
    color: "#0369A1",
    fontWeight: "900",
    fontSize: 14,
    marginBottom: 4,
  },
  infoAlertText: {
    color: "#0C4A6E",
    fontSize: 13,
    fontWeight: "700",
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
    fontWeight: "800",
    color: colors.muted,
    letterSpacing: 1,
    marginBottom: 12,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: "700",
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
    fontWeight: "700",
    color: colors.equusText,
  },
  inputWarningBorder: {
    borderColor: colors.danger,
    borderWidth: 1.5,
    backgroundColor: "#FFF5F5",
  },
  segmentSelector: {
    flexDirection: "row",
    gap: 8,
  },
  segmentBtn: {
    flex: 1,
    height: 46,
    backgroundColor: colors.inputBg,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: "center",
    alignItems: "center",
  },
  segmentBtnActive: {
    backgroundColor: colors.equusGreen,
    borderColor: colors.equusGreen,
  },
  segmentText: {
    fontSize: 13,
    fontWeight: "800",
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
    textAlignVertical: "top",
  },
  submitContainer: {
    gap: 4,
    marginBottom: 30,
  },
});
