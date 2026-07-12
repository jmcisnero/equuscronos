import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  TouchableOpacity,
  TextInput,
  Animated,
  Keyboard,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LocalCompetitionEntry } from "../database/schema";
import { colors } from "../theme/colors";
import { getDatabase } from "../database/db";
import SyncService from "../services/SyncService";
import { ValidationService } from "../services/ValidationService";
import {
  TimeRecordType,
  ParticipantStatus,
  UserRole,
  EliminationCode,
} from "@equuscronos/shared";
import { useAuth } from "../services/AuthContext";

interface TimingScreenProps {
  entry?: LocalCompetitionEntry | null;
  stationRecordType?: TimeRecordType;
  onBack: () => void;
  onRecordSuccess: () => void;
  onNavigateToSyncMonitor?: () => void;
}

interface SessionRecord {
  id: string;
  bibNumber: number;
  riderName: string;
  horseName: string;
  recordedAt: string; // ISO String
  recordType: TimeRecordType;
  isVoid: boolean;
  voidReason?: string | null;
  stageId: string;
  entryId: string;
}

export const TimingScreen: React.FC<TimingScreenProps> = ({
  entry,
  stationRecordType = TimeRecordType.ARRIVAL,
  onBack,
  onRecordSuccess,
  onNavigateToSyncMonitor,
}) => {
  const { user } = useAuth();

  // Real-time synchronization states
  const [pendingCount, setPendingCount] = useState(0);
  const [hasErrors, setHasErrors] = useState(false);
  const [isOnline, setIsOnline] = useState(SyncService.isOnline());

  useEffect(() => {
    const updateCount = async () => {
      const size = await SyncService.getQueueSize();
      setPendingCount(size);

      try {
        const db = await getDatabase();
        const failed = await db.getFirstAsync<{ count: number }>(
          "SELECT COUNT(*) as count FROM sync_queue WHERE attempts > 0;",
        );
        setHasErrors(failed ? failed.count > 0 : false);
      } catch (err) {
        console.warn("[TimingScreen] Error querying errors count:", err);
      }
    };

    updateCount();
    const unsubscribeQueue = SyncService.registerQueueListener(updateCount);
    const unsubscribeStatus = SyncService.registerStatusListener(
      (connected) => {
        setIsOnline(connected);
      },
    );

    return () => {
      unsubscribeQueue();
      unsubscribeStatus();
    };
  }, []);
  const [showDqAlert, setShowDqAlert] = useState(false);
  const showBackButton =
    user?.role !== UserRole.TIMEKEEPER && user?.role !== UserRole.JUDGE;

  // Ocultar selector y hacer tipo de evento inmutable para la sesión
  const [recordType] = useState<TimeRecordType>(stationRecordType);
  const [timeSource, setTimeSource] = useState<"SYSTEM" | "MANUAL">("SYSTEM");
  const [systemTime, setSystemTime] = useState<Date>(new Date());
  const [manualOffsetSeconds, setManualOffsetSeconds] = useState<number>(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Stream States
  const [bibNumber, setBibNumber] = useState(
    entry ? entry.bib_number.toString() : "",
  );
  const [matchedEntry, setMatchedEntry] =
    useState<LocalCompetitionEntry | null>(entry || null);
  const [sessionHistory, setSessionHistory] = useState<SessionRecord[]>([]);
  const [lastSaved, setLastSaved] = useState<{
    bib: number;
    time: string;
  } | null>(null);

  // Editing & Voiding Dialog States
  const [actionRecord, setActionRecord] = useState<SessionRecord | null>(null);
  const [actionType, setActionType] = useState<"EDIT" | "VOID" | null>(null);
  const [voidReasonText, setVoidReasonText] = useState("");
  const [editHours, setEditHours] = useState("");
  const [editMinutes, setEditMinutes] = useState("");
  const [editSeconds, setEditSeconds] = useState("");

  // Refs & Animation
  const inputRef = useRef<TextInput>(null);
  const flashAnim = useRef(new Animated.Value(0)).current;

  // Tick the clock every 50ms for high-precision timekeeping
  useEffect(() => {
    const timer = setInterval(() => {
      setSystemTime(new Date());
    }, 50);
    return () => clearInterval(timer);
  }, []);

  // Focus input on screen mount
  useEffect(() => {
    const focusTimer = setTimeout(() => {
      inputRef.current?.focus();
    }, 200);
    return () => clearTimeout(focusTimer);
  }, []);

  // Fetch recent records to populate session history
  const loadRecentRecords = async () => {
    try {
      const db = await getDatabase();
      const rows = await db.getAllAsync<any>(
        `SELECT tr.id, tr.recorded_at, tr.record_type, tr.is_void, tr.void_reason, tr.stage_id, tr.entry_id, ce.bib_number, ce.rider_name, ce.horse_name
         FROM timing_records tr
         JOIN competition_entries ce ON tr.entry_id = ce.id
         ORDER BY tr.recorded_at DESC
         LIMIT 20;`,
      );
      const mapped: SessionRecord[] = rows.map((r) => ({
        id: r.id,
        bibNumber: r.bib_number,
        riderName: r.rider_name,
        horseName: r.horse_name,
        recordedAt: r.recorded_at,
        recordType: r.record_type as TimeRecordType,
        isVoid: r.is_void === 1,
        voidReason: r.void_reason,
        stageId: r.stage_id,
        entryId: r.entry_id,
      }));
      setSessionHistory(mapped);
    } catch (err) {
      console.error("[Timing] Failed to load recent records:", err);
    }
  };

  useEffect(() => {
    loadRecentRecords();
  }, []);

  // Real-time lookup of competitor as bib number changes
  useEffect(() => {
    const lookupBib = async () => {
      const trimmed = bibNumber.trim();
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
        console.error("[Timing] Database lookup error:", e);
        setMatchedEntry(null);
      }
    };

    lookupBib();
  }, [bibNumber]);

  const getTargetTime = (): Date => {
    if (timeSource === "SYSTEM") return systemTime;
    return new Date(systemTime.getTime() + manualOffsetSeconds * 1000);
  };

  const triggerFlash = () => {
    flashAnim.setValue(1);
    Animated.sequence([
      Animated.timing(flashAnim, {
        toValue: 1,
        duration: 100,
        useNativeDriver: false,
      }),
      Animated.timing(flashAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: false,
      }),
    ]).start();
  };

  const handleRecordTime = async () => {
    if (isSubmitting) return;

    const trimmed = bibNumber.trim();
    if (!trimmed) {
      Alert.alert("Entrada Vacía", "Por favor, ingrese un número de dorsal.", [
        {
          text: "OK",
          onPress: () => {
            setBibNumber("");
            setTimeout(() => inputRef.current?.focus(), 150);
          },
        },
      ]);
      return;
    }

    const bibInt = parseInt(trimmed, 10);
    if (isNaN(bibInt)) {
      Alert.alert("Error", "Ingrese un número de dorsal válido.", [
        {
          text: "OK",
          onPress: () => {
            setBibNumber("");
            setTimeout(() => inputRef.current?.focus(), 150);
          },
        },
      ]);
      return;
    }

    setIsSubmitting(true);
    const recordTime = getTargetTime();
    const recordedAt = recordTime.toISOString();

    try {
      const db = await getDatabase();

      // Verify competitor exists in SQLite local DB
      const entryRow = await db.getFirstAsync<LocalCompetitionEntry>(
        "SELECT * FROM competition_entries WHERE bib_number = ?;",
        [bibInt],
      );

      if (!entryRow) {
        Alert.alert(
          "Dorsal no encontrado",
          "Dorsal no encontrado en esta carrera",
          [
            {
              text: "OK",
              onPress: () => {
                setBibNumber("");
                setTimeout(() => inputRef.current?.focus(), 150);
              },
            },
          ],
        );
        setIsSubmitting(false);
        return;
      }

      const tenantId = entryRow.tenant_id;
      const stageId = entryRow.current_stage_id;

      // 1. Validar secuencia e idempotencia reglamentaria FEU
      const valResult = await ValidationService.validateTimingRecord(
        db,
        entryRow.id,
        stageId,
        recordType,
      );

      if (!valResult.isValid) {
        Alert.alert(
          "Validación de Secuencia",
          valResult.error || "Operación denegada por reglas FEU.",
          [
            {
              text: "Entendido",
              onPress: () => {
                setBibNumber("");
                setTimeout(() => inputRef.current?.focus(), 150);
              },
            },
          ],
        );
        setIsSubmitting(false);
        return;
      }

      const recordId = `tr-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      // Determine target competitor status depending on TimeRecordType selected
      let targetStatus = entryRow.status;
      let isApproved = 1;
      let eliminationType: string | null = null;
      let eliminationReason: string | null = null;
      let isLateVetIn = false;

      if (recordType === TimeRecordType.START) {
        targetStatus = ParticipantStatus.IN_RACE;
      } else if (recordType === TimeRecordType.ARRIVAL) {
        targetStatus = ParticipantStatus.VET_CHECK;
      } else if (recordType === TimeRecordType.VET_IN) {
        targetStatus = ParticipantStatus.VET_CHECK;
        // Verify 20-minute recovery limit
        const arrivalRecord = await db.getFirstAsync<{ recorded_at: string }>(
          `SELECT recorded_at FROM timing_records 
           WHERE entry_id = ? AND stage_id = ? AND record_type = ? AND is_void = 0;`,
          [entryRow.id, stageId, TimeRecordType.ARRIVAL],
        );
        if (arrivalRecord) {
          const diffMs =
            new Date(recordedAt).getTime() -
            new Date(arrivalRecord.recorded_at).getTime();
          if (diffMs > 20 * 60 * 1000) {
            const diffMinutes = Math.round(diffMs / (1000 * 60));
            isApproved = 0;
            eliminationType = EliminationCode.TIME;
            eliminationReason = `Fuera de tiempo de recuperación: ${diffMinutes} minutos (Límite: 20 min).`;
            isLateVetIn = true;
            targetStatus = ParticipantStatus.DQ;
          }
        }
      } else if (recordType === TimeRecordType.VET_OUT) {
        targetStatus = ParticipantStatus.RESTING;
      }

      // 1. Transactionally write to SQLite local tables (Source of truth)
      await db.runAsync(
        `INSERT INTO timing_records (
          id, tenant_id, entry_id, stage_id, record_type, recorded_at, is_approved, elimination_type, elimination_reason, is_void, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?);`,
        [
          recordId,
          tenantId,
          entryRow.id,
          stageId,
          recordType,
          recordedAt,
          isApproved,
          eliminationType,
          eliminationReason,
          recordedAt,
          recordedAt,
        ],
      );

      await db.runAsync(
        `UPDATE competition_entries SET status = ?, updated_at = ? WHERE id = ?;`,
        [targetStatus, recordedAt, entryRow.id],
      );

      console.log(
        `[SQLite] Local database updated. Entry: ${entryRow.id}, Status: ${targetStatus}`,
      );

      // 2. Queue actions for Backend Synchronization (Postgres)
      await SyncService.enqueueAction("CREATE_TIMING", "timing_records", {
        id: recordId,
        tenant_id: tenantId,
        entry_id: entryRow.id,
        stage_id: stageId,
        record_type: recordType,
        recorded_at: recordedAt,
        is_approved: isApproved,
        elimination_type: eliminationType || null,
        elimination_reason: eliminationReason || null,
        is_void: 0,
        created_at: recordedAt,
        updated_at: recordedAt,
      });

      await SyncService.enqueueAction(
        "UPDATE_ENTRY_STATUS",
        "competition_entries",
        {
          id: entryRow.id,
          status: targetStatus,
        },
      );

      // 3. Success Feedback UI updates
      await loadRecentRecords();

      if (isLateVetIn) {
        setShowDqAlert(true);
        Alert.alert(
          "DORSAL EXCEDIDO",
          "DORSAL EXCEDIDO: ELIMINACIÓN AUTOMÁTICA",
          [
            {
              text: "OK",
              onPress: () => {
                setBibNumber("");
                setTimeout(() => inputRef.current?.focus(), 150);
              },
            },
          ],
        );
      } else {
        setLastSaved({ bib: bibInt, time: formattedTime(recordTime) });
        triggerFlash();
        setBibNumber("");
      }
    } catch (error) {
      console.error("[Timing] Write failed:", error);
      Alert.alert(
        "Error",
        "No se pudo guardar el registro local en la base de datos.",
        [
          {
            text: "OK",
            onPress: () => {
              setBibNumber("");
              setTimeout(() => inputRef.current?.focus(), 150);
            },
          },
        ],
      );
    } finally {
      setIsSubmitting(false);
      // Keep/Restore focus on the input immediately
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  };

  const formattedTime = (date: Date): string => {
    const hh = String(date.getHours()).padStart(2, "0");
    const mm = String(date.getMinutes()).padStart(2, "0");
    const ss = String(date.getSeconds()).padStart(2, "0");
    return `${hh}:${mm}:${ss}`;
  };

  const adjustOffset = (amount: number) => {
    setTimeSource("MANUAL");
    setManualOffsetSeconds((prev) => prev + amount);
  };

  // Interpolate flash animation values for high-visibility visual feedback
  const animatedBorderColor = flashAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["#334155", "#10B981"], // Slate border to neon-green border
  });

  const animatedBgColor = flashAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["#1E293B", "rgba(16, 185, 129, 0.12)"], // Slate background to soft green glow
  });

  // Action Handlers
  const handleCancelAction = () => {
    setActionRecord(null);
    setActionType(null);
    setVoidReasonText("");
    setEditHours("");
    setEditMinutes("");
    setEditSeconds("");
    setTimeout(() => inputRef.current?.focus(), 150);
  };

  const openActionDialog = (record: SessionRecord, type: "EDIT" | "VOID") => {
    setActionRecord(record);
    setActionType(type);
    if (type === "EDIT") {
      const date = new Date(record.recordedAt);
      setEditHours(String(date.getHours()).padStart(2, "0"));
      setEditMinutes(String(date.getMinutes()).padStart(2, "0"));
      setEditSeconds(String(date.getSeconds()).padStart(2, "0"));
    }
  };

  const handleConfirmVoid = async () => {
    if (!voidReasonText.trim()) {
      Alert.alert(
        "Justificación requerida",
        "Por favor, ingrese el motivo de la anulación.",
      );
      return;
    }

    try {
      const db = await getDatabase();
      const now = new Date().toISOString();

      // Update timing record locally to is_void = 1
      await db.runAsync(
        "UPDATE timing_records SET is_void = 1, void_reason = ?, updated_at = ? WHERE id = ?;",
        [voidReasonText.trim(), now, actionRecord!.id],
      );

      // Recalculate participant status by querying remaining active records
      const activeRows = await db.getAllAsync<{ record_type: string }>(
        "SELECT record_type FROM timing_records WHERE entry_id = ? AND is_void = 0 ORDER BY recorded_at DESC;",
        [actionRecord!.entryId],
      );

      let targetStatus = ParticipantStatus.IN_RACE;
      if (activeRows.length > 0) {
        const latestType = activeRows[0].record_type as TimeRecordType;
        if (latestType === TimeRecordType.START) {
          targetStatus = ParticipantStatus.IN_RACE;
        } else if (
          latestType === TimeRecordType.ARRIVAL ||
          latestType === TimeRecordType.VET_IN
        ) {
          targetStatus = ParticipantStatus.VET_CHECK;
        } else if (latestType === TimeRecordType.VET_OUT) {
          targetStatus = ParticipantStatus.RESTING;
        }
      }

      await db.runAsync(
        "UPDATE competition_entries SET status = ?, updated_at = ? WHERE id = ?;",
        [targetStatus, now, actionRecord!.entryId],
      );

      // Queue sync actions
      await SyncService.enqueueAction("VOID_TIMING", "timing_records", {
        id: actionRecord!.id,
        voidReason: voidReasonText.trim(),
      });

      await SyncService.enqueueAction(
        "UPDATE_ENTRY_STATUS",
        "competition_entries",
        {
          id: actionRecord!.entryId,
          status: targetStatus,
        },
      );

      Alert.alert("Éxito", "Registro anulado correctamente.");
      await loadRecentRecords();
      handleCancelAction();
    } catch (err) {
      console.error("[Timing] Void error:", err);
      Alert.alert("Error", "No se pudo anular el registro de tiempo.");
    }
  };

  const handleConfirmEdit = async () => {
    const h = parseInt(editHours, 10);
    const m = parseInt(editMinutes, 10);
    const s = parseInt(editSeconds, 10);

    if (
      isNaN(h) ||
      h < 0 ||
      h > 23 ||
      isNaN(m) ||
      m < 0 ||
      m > 59 ||
      isNaN(s) ||
      s < 0 ||
      s > 59
    ) {
      Alert.alert(
        "Error",
        "Ingrese un formato de tiempo válido (HH: 00-23, MM: 00-59, SS: 00-59).",
      );
      return;
    }

    try {
      const db = await getDatabase();

      // Validar: "siempre que sea dentro de la misma etapa y antes de la presentación olímpica"
      if (actionRecord!.recordType === TimeRecordType.ARRIVAL) {
        const vetInRow = await db.getFirstAsync(
          "SELECT id FROM timing_records WHERE entry_id = ? AND stage_id = ? AND record_type = 'VET_IN' AND is_void = 0;",
          [actionRecord!.entryId, actionRecord!.stageId],
        );
        if (vetInRow) {
          Alert.alert(
            "Modificación Denegada",
            "No se puede modificar la llegada porque el binomio ya ingresó a inspección veterinaria (VET_IN).",
          );
          return;
        }
      } else if (actionRecord!.recordType === TimeRecordType.START) {
        const arrivalRow = await db.getFirstAsync(
          "SELECT id FROM timing_records WHERE entry_id = ? AND stage_id = ? AND record_type = 'ARRIVAL' AND is_void = 0;",
          [actionRecord!.entryId, actionRecord!.stageId],
        );
        if (arrivalRow) {
          Alert.alert(
            "Modificación Denegada",
            "No se puede modificar la largada porque el binomio ya registró su llegada (ARRIVAL).",
          );
          return;
        }
      }

      // Reconstruct ISO string date with edited time
      const targetDate = new Date(actionRecord!.recordedAt);
      targetDate.setHours(h);
      targetDate.setMinutes(m);
      targetDate.setSeconds(s);
      const newIsoString = targetDate.toISOString();
      const now = new Date().toISOString();

      // Update timing record locally
      await db.runAsync(
        "UPDATE timing_records SET recorded_at = ?, updated_at = ? WHERE id = ?;",
        [newIsoString, now, actionRecord!.id],
      );

      // Enqueue sync action
      await SyncService.enqueueAction("UPDATE_TIMING", "timing_records", {
        id: actionRecord!.id,
        recordedAt: newIsoString,
      });

      Alert.alert("Éxito", "Registro modificado correctamente.");
      await loadRecentRecords();
      handleCancelAction();
    } catch (err) {
      console.error("[Timing] Edit error:", err);
      Alert.alert("Error", "No se pudo guardar la modificación del registro.");
    }
  };

  const successfulRecords = sessionHistory
    .filter((r) => !r.isVoid && r.recordType === recordType)
    .slice(0, 5);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#0B0F19" }}>
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            {showBackButton && (
              <TouchableOpacity style={styles.backButton} onPress={onBack}>
                <Text style={styles.backText}>⬅️ Volver</Text>
              </TouchableOpacity>
            )}

            {/* Sync Badge Trigger */}
            <TouchableOpacity
              onPress={onNavigateToSyncMonitor}
              style={styles.syncHeaderTrigger}
              activeOpacity={0.7}
            >
              <Text style={styles.syncCloudIcon}>{isOnline ? "☁️" : "📶"}</Text>
              {pendingCount > 0 && (
                <View
                  style={[
                    styles.syncBadgeCircle,
                    { backgroundColor: hasErrors ? "#EF4444" : "#F59E0B" },
                  ]}
                >
                  <Text style={styles.syncBadgeText}>{pendingCount}</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>

          <View style={{ alignItems: "flex-end" }}>
            <Text style={styles.title}>
              {recordType === TimeRecordType.START
                ? "LARGADAS"
                : recordType === TimeRecordType.ARRIVAL
                  ? "ARRIBOS"
                  : "VET IN"}
            </Text>
            <Text style={styles.subtitle}>Puesto Activo</Text>
          </View>
        </View>

        {/* Master Chronometer */}
        <View style={styles.chronoContainer}>
          <Text style={styles.chronoTitle}>RELOJ DE COMPETENCIA (OFICIAL)</Text>
          <Text style={styles.chronoDigits}>
            {formattedTime(getTargetTime())}
          </Text>
          <View style={styles.sourceSelector}>
            <TouchableOpacity
              style={[
                styles.sourceBtn,
                timeSource === "SYSTEM" && styles.sourceBtnActive,
              ]}
              onPress={() => {
                setTimeSource("SYSTEM");
                setManualOffsetSeconds(0);
              }}
            >
              <Text
                style={[
                  styles.sourceText,
                  timeSource === "SYSTEM" && styles.sourceTextActive,
                ]}
              >
                Automática
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.sourceBtn,
                timeSource === "MANUAL" && styles.sourceBtnActive,
              ]}
              onPress={() => setTimeSource("MANUAL")}
            >
              <Text
                style={[
                  styles.sourceText,
                  timeSource === "MANUAL" && styles.sourceTextActive,
                ]}
              >
                Ajuste Manual
              </Text>
            </TouchableOpacity>
          </View>

          {timeSource === "MANUAL" && (
            <View style={styles.manualControls}>
              <TouchableOpacity
                style={styles.offsetBtn}
                onPress={() => adjustOffset(-60)}
              >
                <Text style={styles.offsetBtnText}>-1m</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.offsetBtn}
                onPress={() => adjustOffset(-1)}
              >
                <Text style={styles.offsetBtnText}>-1s</Text>
              </TouchableOpacity>
              <Text style={styles.offsetValue}>
                {manualOffsetSeconds > 0
                  ? `+${manualOffsetSeconds}s`
                  : `${manualOffsetSeconds}s`}
              </Text>
              <TouchableOpacity
                style={styles.offsetBtn}
                onPress={() => adjustOffset(1)}
              >
                <Text style={styles.offsetBtnText}>+1s</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.offsetBtn}
                onPress={() => adjustOffset(60)}
              >
                <Text style={styles.offsetBtnText}>+1m</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* DQ Alert / Notification */}
        {showDqAlert && (
          <View style={styles.dqAlertBanner}>
            <Text style={styles.dqAlertText}>
              ⚠️ DORSAL EXCEDIDO: ELIMINACIÓN AUTOMÁTICA
            </Text>
          </View>
        )}

        {/* Success Toast / Notification */}
        {lastSaved && (
          <View style={styles.successToast}>
            <Text style={styles.successToastText}>
              ✓ Dorsal #{lastSaved.bib} registrado a las {lastSaved.time}
            </Text>
          </View>
        )}

        {/* Big Bib Entry Box (High visibility under direct sunlight) */}
        <Animated.View
          style={[
            styles.inputCard,
            {
              borderColor: animatedBorderColor,
              backgroundColor: animatedBgColor,
            },
          ]}
        >
          <Text style={styles.inputLabel}>INGRESE NÚMERO DE DORSAL</Text>

          <TextInput
            ref={inputRef}
            style={styles.bigInput}
            value={bibNumber}
            onChangeText={(text) => {
              setBibNumber(text);
              setShowDqAlert(false);
            }}
            placeholder="000"
            placeholderTextColor="rgba(255, 255, 255, 0.15)"
            keyboardType="numeric"
            returnKeyType="done"
            autoFocus={true}
            blurOnSubmit={false}
            onSubmitEditing={handleRecordTime}
            selectTextOnFocus={true}
          />

          {/* Real-time search feedback */}
          <View style={styles.matchedContainer}>
            {matchedEntry ? (
              <View style={{ alignItems: "center" }}>
                <Text style={styles.matchedName}>
                  👤 {matchedEntry.rider_name}
                </Text>
                <Text style={styles.matchedHorse}>
                  🐴 {matchedEntry.horse_name}
                </Text>
                <Text style={styles.matchedStatus}>
                  Estado:{" "}
                  <Text style={styles.matchedStatusValue}>
                    {matchedEntry.status}
                  </Text>
                </Text>
              </View>
            ) : bibNumber.trim().length > 0 ? (
              <Text style={styles.noMatchText}>⚠️ Dorsal no registrado</Text>
            ) : (
              <Text style={styles.placeholderText}>
                Esperando número de dorsal...
              </Text>
            )}
          </View>
        </Animated.View>

        {/* Action Button */}
        <TouchableOpacity
          style={styles.submitBtn}
          onPress={handleRecordTime}
          disabled={isSubmitting}
        >
          <Text style={styles.submitBtnText}>
            {isSubmitting ? "Registrando..." : "⏱️ Registrar Tiempo"}
          </Text>
        </TouchableOpacity>

        {/* Últimos 5 Registros Exitosos con Editar/Anular */}
        <View style={styles.quickRecentCard}>
          <Text style={styles.cardSectionTitle}>
            ÚLTIMOS 5 REGISTROS EXITOSOS (EDITAR/ANULAR)
          </Text>
          {successfulRecords.length > 0 ? (
            successfulRecords.map((item) => (
              <View key={item.id} style={styles.quickRecentItem}>
                <View style={styles.quickRecentLeft}>
                  <View style={styles.quickRecentBibRow}>
                    <Text style={styles.quickRecentBib}>#{item.bibNumber}</Text>
                    <Text style={styles.quickRecentRider} numberOfLines={1}>
                      {item.riderName}
                    </Text>
                  </View>
                  <Text style={styles.quickRecentTime}>
                    {formattedTime(new Date(item.recordedAt))} -{" "}
                    <Text style={styles.quickRecentTypeText}>
                      {item.recordType}
                    </Text>
                  </Text>
                </View>
                <View style={styles.quickRecentActions}>
                  <TouchableOpacity
                    style={[styles.quickActionBtn, styles.editActionBtn]}
                    onPress={() => openActionDialog(item, "EDIT")}
                  >
                    <Text style={styles.quickActionBtnText}>Editar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.quickActionBtn, styles.voidActionBtn]}
                    onPress={() => openActionDialog(item, "VOID")}
                  >
                    <Text style={styles.quickActionBtnText}>Anular</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))
          ) : (
            <Text style={styles.noHistoryText}>
              No hay registros exitosos en esta sesión.
            </Text>
          )}
        </View>

        {/* Session History Feed (Full view including voided records) */}
        <View style={styles.historyCard}>
          <Text style={styles.cardSectionTitle}>HISTORIAL DE ESTA SESIÓN</Text>
          {sessionHistory.length > 0 ? (
            sessionHistory.map((item) => (
              <View
                key={item.id}
                style={[
                  styles.historyItem,
                  item.isVoid && styles.historyItemVoid,
                ]}
              >
                <View style={styles.historyLeft}>
                  <View style={styles.historyBibRow}>
                    <Text
                      style={[
                        styles.historyBib,
                        item.isVoid && styles.historyTextVoid,
                      ]}
                    >
                      #{item.bibNumber}
                    </Text>
                    <Text
                      style={[
                        styles.historyRider,
                        item.isVoid && styles.historyTextVoid,
                      ]}
                      numberOfLines={1}
                    >
                      {item.riderName} {item.isVoid && "(ANULADO)"}
                    </Text>
                  </View>
                  <Text
                    style={[
                      styles.historyHorse,
                      item.isVoid && styles.historyTextVoid,
                    ]}
                    numberOfLines={1}
                  >
                    🐴 {item.horseName}{" "}
                    {item.voidReason ? `[Motivo: ${item.voidReason}]` : ""}
                  </Text>
                </View>
                <View style={styles.historyRight}>
                  <Text
                    style={[
                      styles.historyType,
                      item.isVoid && styles.historyTypeVoid,
                    ]}
                  >
                    {item.recordType}
                  </Text>
                  <Text
                    style={[
                      styles.historyTime,
                      item.isVoid && styles.historyTextVoid,
                    ]}
                  >
                    {formattedTime(new Date(item.recordedAt))}
                  </Text>
                </View>
              </View>
            ))
          ) : (
            <Text style={styles.noHistoryText}>
              No hay registros recientes.
            </Text>
          )}
        </View>
      </ScrollView>

      {/* Dialog for Edit / Void Action */}
      {actionRecord && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {actionType === "VOID" ? (
              <View>
                <Text style={styles.modalTitle}>⚠️ ANULAR REGISTRO</Text>
                <Text style={styles.modalSubtitle}>
                  Dorsal #{actionRecord.bibNumber} - {actionRecord.recordType}
                </Text>
                <Text style={styles.modalWarning}>
                  La anulación es irreversible en pista y requiere una
                  justificación técnica obligatoria para la FEU.
                </Text>

                <TextInput
                  style={styles.modalInput}
                  value={voidReasonText}
                  onChangeText={setVoidReasonText}
                  placeholder="Ej. Error de tipeo / Doble registro"
                  placeholderTextColor="#64748B"
                  autoFocus={true}
                />

                <View style={styles.modalActions}>
                  <TouchableOpacity
                    style={[styles.modalBtn, styles.cancelBtn]}
                    onPress={handleCancelAction}
                  >
                    <Text style={styles.cancelBtnText}>Cancelar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.modalBtn, styles.confirmVoidBtn]}
                    onPress={handleConfirmVoid}
                  >
                    <Text style={styles.confirmVoidBtnText}>
                      Confirmar Anulación
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <View>
                <Text style={styles.modalTitle}>✏️ MODIFICAR TIEMPO</Text>
                <Text style={styles.modalSubtitle}>
                  Dorsal #{actionRecord.bibNumber} - {actionRecord.recordType}
                </Text>

                <View style={styles.timeEditGrid}>
                  <View style={styles.timeInputCol}>
                    <Text style={styles.timeInputLabel}>HH</Text>
                    <TextInput
                      style={styles.timeNumberInput}
                      value={editHours}
                      onChangeText={setEditHours}
                      keyboardType="numeric"
                      maxLength={2}
                      selectTextOnFocus={true}
                    />
                  </View>
                  <Text style={styles.timeSeparator}>:</Text>
                  <View style={styles.timeInputCol}>
                    <Text style={styles.timeInputLabel}>MM</Text>
                    <TextInput
                      style={styles.timeNumberInput}
                      value={editMinutes}
                      onChangeText={setEditMinutes}
                      keyboardType="numeric"
                      maxLength={2}
                      selectTextOnFocus={true}
                    />
                  </View>
                  <Text style={styles.timeSeparator}>:</Text>
                  <View style={styles.timeInputCol}>
                    <Text style={styles.timeInputLabel}>SS</Text>
                    <TextInput
                      style={styles.timeNumberInput}
                      value={editSeconds}
                      onChangeText={setEditSeconds}
                      keyboardType="numeric"
                      maxLength={2}
                      selectTextOnFocus={true}
                    />
                  </View>
                </View>

                <View style={styles.modalActions}>
                  <TouchableOpacity
                    style={[styles.modalBtn, styles.cancelBtn]}
                    onPress={handleCancelAction}
                  >
                    <Text style={styles.cancelBtnText}>Cancelar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.modalBtn, styles.confirmEditBtn]}
                    onPress={handleConfirmEdit}
                  >
                    <Text style={styles.confirmEditBtnText}>
                      Guardar Cambios
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
    backgroundColor: "#0B0F19", // Deep dark slate/black for high contrast under sunlight
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
    justifyContent: "space-between",
  },
  backButton: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: "#1E293B",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#334155",
  },
  backText: {
    fontWeight: "800",
    color: "#F8FAFC",
    fontSize: 14,
  },
  title: {
    fontSize: 18,
    fontWeight: "900",
    color: "#FBBF24", // Amber/gold for maximum legibility
    letterSpacing: 1,
  },
  subtitle: {
    fontSize: 10,
    fontWeight: "800",
    color: "#38BDF8",
    letterSpacing: 1,
    marginTop: 2,
    textTransform: "uppercase",
  },
  chronoContainer: {
    backgroundColor: "#020617", // Pitch black for chrono high contrast
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#1E293B",
  },
  chronoTitle: {
    fontSize: 11,
    fontWeight: "800",
    color: "#94A3B8",
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  chronoDigits: {
    fontSize: 38,
    fontFamily: "monospace",
    fontWeight: "900",
    color: "#38BDF8", // Cyan light digits
    letterSpacing: 2,
    marginBottom: 12,
  },
  sourceSelector: {
    flexDirection: "row",
    backgroundColor: "#1E293B",
    borderRadius: 8,
    padding: 4,
  },
  sourceBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  sourceBtnActive: {
    backgroundColor: "#10B981", // Emerald green
  },
  sourceText: {
    color: "#94A3B8",
    fontSize: 12,
    fontWeight: "700",
  },
  sourceTextActive: {
    color: "#FFFFFF",
  },
  manualControls: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 12,
    gap: 8,
  },
  offsetBtn: {
    backgroundColor: "#334155",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  offsetBtnText: {
    color: "#FFFFFF",
    fontWeight: "800",
  },
  offsetValue: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
    minWidth: 50,
    textAlign: "center",
  },
  inputCard: {
    borderRadius: 16,
    padding: 20,
    borderWidth: 2,
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: "800",
    color: "#94A3B8",
    letterSpacing: 1,
    textAlign: "center",
    marginBottom: 10,
  },
  bigInput: {
    fontSize: 64, // Large typography (48px - 64px)
    fontWeight: "900",
    color: "#FFFFFF",
    textAlign: "center",
    fontFamily: "monospace",
    paddingVertical: 10,
  },
  matchedContainer: {
    marginTop: 12,
    alignItems: "center",
    minHeight: 50,
  },
  matchedName: {
    fontSize: 18,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  matchedHorse: {
    fontSize: 14,
    color: "#94A3B8",
    marginTop: 2,
  },
  matchedStatus: {
    fontSize: 13,
    color: "#94A3B8",
    marginTop: 4,
  },
  matchedStatusValue: {
    fontWeight: "800",
    color: "#10B981",
  },
  noMatchText: {
    color: "#EF4444",
    fontWeight: "800",
    fontSize: 15,
  },
  placeholderText: {
    color: "#64748B",
    fontSize: 13,
    fontStyle: "italic",
  },
  successToast: {
    backgroundColor: "rgba(16, 185, 129, 0.15)",
    borderColor: "#10B981",
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: 12,
    alignItems: "center",
  },
  successToastText: {
    color: "#10B981",
    fontWeight: "800",
    fontSize: 14,
  },
  lockedEventCard: {
    backgroundColor: "#0F172A",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#1E293B",
    marginBottom: 16,
  },
  lockedEventLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: "#64748B",
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  lockedEventValue: {
    fontSize: 16,
    fontWeight: "900",
    color: "#38BDF8",
  },
  submitBtn: {
    backgroundColor: "#10B981",
    borderRadius: 10,
    height: 52,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
  },
  submitBtnText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  quickRecentCard: {
    backgroundColor: "#1E293B",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#334155",
    marginBottom: 16,
  },
  quickRecentItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#334155",
  },
  quickRecentLeft: {
    flex: 1,
    marginRight: 8,
  },
  quickRecentBibRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  quickRecentBib: {
    fontSize: 16,
    fontWeight: "900",
    color: "#38BDF8",
  },
  quickRecentRider: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  quickRecentTime: {
    fontSize: 12,
    fontFamily: "monospace",
    color: "#94A3B8",
    marginTop: 2,
  },
  quickRecentTypeText: {
    color: "#FBBF24",
    fontWeight: "800",
    fontSize: 10,
  },
  quickRecentActions: {
    flexDirection: "row",
    gap: 6,
  },
  quickActionBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
    justifyContent: "center",
    alignItems: "center",
  },
  editActionBtn: {
    backgroundColor: "#0284C7",
  },
  voidActionBtn: {
    backgroundColor: "#B91C1C",
  },
  quickActionBtnText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "800",
  },
  historyCard: {
    backgroundColor: "#1E293B",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#334155",
    marginBottom: 30,
  },
  cardSectionTitle: {
    fontSize: 11,
    fontWeight: "800",
    color: "#94A3B8",
    letterSpacing: 1,
    marginBottom: 12,
  },
  historyItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#334155",
  },
  historyItemVoid: {
    opacity: 0.35,
  },
  historyLeft: {
    flex: 1,
    marginRight: 8,
  },
  historyBibRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  historyBib: {
    fontSize: 16,
    fontWeight: "900",
    color: "#38BDF8",
  },
  historyRider: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  historyHorse: {
    fontSize: 12,
    color: "#94A3B8",
    marginTop: 1,
  },
  historyRight: {
    alignItems: "flex-end",
  },
  historyType: {
    fontSize: 10,
    fontWeight: "800",
    color: "#FBBF24",
    backgroundColor: "rgba(251, 191, 36, 0.1)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: "hidden",
  },
  historyTypeVoid: {
    color: "#64748B",
    backgroundColor: "rgba(100, 116, 139, 0.1)",
  },
  historyTime: {
    fontSize: 12,
    fontFamily: "monospace",
    color: "#FFFFFF",
    marginTop: 4,
  },
  historyTextVoid: {
    textDecorationLine: "line-through",
    color: "#64748B",
  },
  noHistoryText: {
    color: "#64748B",
    textAlign: "center",
    fontSize: 13,
    fontStyle: "italic",
    paddingVertical: 12,
  },
  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.75)",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
    zIndex: 999,
  },
  modalContent: {
    width: "100%",
    maxWidth: 400,
    backgroundColor: "#1E293B",
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: "#334155",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: "#EF4444",
    textAlign: "center",
    marginBottom: 6,
  },
  modalSubtitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#FFFFFF",
    textAlign: "center",
    marginBottom: 12,
  },
  modalWarning: {
    fontSize: 12,
    color: "#94A3B8",
    textAlign: "center",
    lineHeight: 18,
    marginBottom: 16,
  },
  modalInput: {
    backgroundColor: "#0F172A",
    borderColor: "#334155",
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    color: "#FFFFFF",
    fontSize: 14,
    marginBottom: 20,
  },
  modalActions: {
    flexDirection: "row",
    gap: 12,
  },
  modalBtn: {
    flex: 1,
    height: 48,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  cancelBtn: {
    backgroundColor: "#334155",
  },
  cancelBtnText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
  confirmVoidBtn: {
    backgroundColor: "#B91C1C",
  },
  confirmVoidBtnText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
  },
  confirmEditBtn: {
    backgroundColor: "#10B981",
  },
  confirmEditBtnText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
  },
  timeEditGrid: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginVertical: 20,
    gap: 10,
  },
  timeInputCol: {
    alignItems: "center",
  },
  timeInputLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: "#64748B",
    marginBottom: 4,
  },
  timeNumberInput: {
    backgroundColor: "#0F172A",
    borderWidth: 1,
    borderColor: "#334155",
    borderRadius: 8,
    width: 60,
    height: 50,
    textAlign: "center",
    color: "#FFFFFF",
    fontSize: 22,
    fontWeight: "900",
    fontFamily: "monospace",
  },
  timeSeparator: {
    color: "#94A3B8",
    fontSize: 24,
    fontWeight: "900",
    marginTop: 15,
  },
  dqAlertBanner: {
    backgroundColor: "#EF4444",
    padding: 16,
    borderRadius: 8,
    marginVertical: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  dqAlertText: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 16,
    textAlign: "center",
  },
  syncHeaderTrigger: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1E293B",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#334155",
    marginLeft: 8,
  },
  syncCloudIcon: {
    fontSize: 18,
  },
  syncBadgeCircle: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 4,
    marginLeft: 6,
  },
  syncBadgeText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "900",
  },
});
