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
import { SafeAreaView } from "react-native-safe-area-context";
import { LocalCompetitionEntry } from "../database/schema";
import { colors } from "../theme/colors";
import { Button } from "../components/Button";
import { getDatabase } from "../database/db";
import SyncService from "../services/SyncService";
import ApiService from "../services/ApiService";
import { useAuth } from "../services/AuthContext";
import {
  MotricityStatus,
  ClinicalStatus,
  ParticipantStatus,
  TimeRecordType,
  EliminationCode,
  UserRole,
} from "@equuscronos/shared";

interface PendingVetItem {
  entry: LocalCompetitionEntry;
  calcArrHHMMSS: string;
  nextVetControlTime: string;
  arrivalIso: string;
  vetInRecordId?: string;
  heartRateInput: string;
  requiresRecheck: boolean;
}

interface AttendedVetItem {
  entry: LocalCompetitionEntry;
  inspection: any;
  timingRecord: any;
  savedTimeHHMMSS: string;
}

interface VetGateScreenProps {
  entry: LocalCompetitionEntry | null;
  onBack?: () => void;
  onInspectionSuccess: () => void;
  onNavigateToSyncMonitor?: () => void;
}

export const VetGateScreen: React.FC<VetGateScreenProps> = ({
  entry,
  onBack,
  onInspectionSuccess,
  onNavigateToSyncMonitor,
}) => {
  const { user } = useAuth();

  // Real-time synchronization states
  const [pendingCount, setPendingCount] = useState(0);
  const [hasErrors, setHasErrors] = useState(false);
  const [isOnline, setIsOnline] = useState(SyncService.isOnline());

  // Simple View Fast Table States
  const [rowHeartRate, setRowHeartRate] = useState<Record<string, string>>({});
  const [rowRequiresRecheck, setRowRequiresRecheck] = useState<Record<string, boolean>>({});
  const [rowSavingId, setRowSavingId] = useState<string | null>(null);
  const [pendingList, setPendingList] = useState<PendingVetItem[]>([]);
  const [attendedList, setAttendedList] = useState<AttendedVetItem[]>([]);

  const loadSimpleTablesState = async () => {
    try {
      const db = await getDatabase();
      const initialEntries = await db.getAllAsync<LocalCompetitionEntry>(
        "SELECT * FROM competition_entries ORDER BY bib_number ASC;",
      );

      const compId = initialEntries[0]?.competition_id;
      const onlineMode = SyncService.isOnline();

      // Intento de refresco/espejo Online-First si hay conectividad
      if (onlineMode && compId) {
        try {
          const apiEntries = await ApiService.fetchLatestEntries(compId);
          if (Array.isArray(apiEntries) && apiEntries.length > 0) {
            const now = new Date().toISOString();
            for (const serverEntry of apiEntries) {
              await db.runAsync(
                `UPDATE competition_entries SET status = ?, current_stage_id = ?, updated_at = ? WHERE id = ?;`,
                [
                  serverEntry.status,
                  serverEntry.currentStage?.id || serverEntry.currentStageId || "",
                  now,
                  serverEntry.id,
                ],
              );
              // Espejo de timing_records recibidos del servidor
              if (Array.isArray(serverEntry.timingRecords)) {
                for (const tr of serverEntry.timingRecords) {
                  const existingTr = await db.getFirstAsync(
                    "SELECT id FROM timing_records WHERE id = ?;",
                    [tr.id],
                  );
                  if (!existingTr) {
                    await db.runAsync(
                      `INSERT INTO timing_records (id, tenant_id, entry_id, stage_id, record_type, recorded_at, is_approved, is_void, created_at, updated_at)
                       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
                      [
                        tr.id,
                        tr.tenantId || serverEntry.tenantId || "77777777-7777-7777-7777-777777777777",
                        serverEntry.id,
                        tr.stage?.id || tr.stageId || "",
                        tr.recordType,
                        tr.recordedAt,
                        tr.isApproved ? 1 : 0,
                        tr.isVoid ? 1 : 0,
                        now,
                        now,
                      ],
                    );
                  }
                }
              }
            }
          }
        } catch (apiErr) {
          console.warn(
            "[VetGateScreen] Online refresh failed, falling back to local SQLite state:",
            apiErr,
          );
        }
      }

      const allEntries = await db.getAllAsync<LocalCompetitionEntry>(
        "SELECT id, tenant_id, competition_id, rider_id, rider_name, horse_id, horse_name, bib_number, status, current_stage_id, ballast_weight, created_at, updated_at, vet_inspection_mode FROM competition_entries ORDER BY bib_number ASC;",
      );

      // Batch load ARRIVAL records
      const allArrivals = await db.getAllAsync<{ entry_id: string; recorded_at: string }>(
        "SELECT entry_id, recorded_at FROM timing_records WHERE record_type = 'ARRIVAL' AND is_void = 0 ORDER BY recorded_at DESC;",
      );
      const arrivalMap = new Map<string, string>();
      for (const arr of allArrivals) {
        if (!arrivalMap.has(arr.entry_id)) {
          arrivalMap.set(arr.entry_id, arr.recorded_at);
        }
      }

      // Batch load VET_IN records with inspections
      const allVetIns = await db.getAllAsync<any>(
        `SELECT tr.entry_id, tr.id as timing_record_id, tr.recorded_at as vet_in_recorded_at, 
                vi.id as vet_id, vi.heart_rate, vi.attempt_number, vi.is_recheck_required, vi.created_at as vet_created_at
         FROM timing_records tr
         INNER JOIN vet_inspections vi ON vi.timing_record_id = tr.id
         WHERE tr.record_type = 'VET_IN' AND tr.is_void = 0
         ORDER BY vi.created_at DESC;`,
      );
      const vetInMap = new Map<string, any[]>();
      for (const vet of allVetIns) {
        const list = vetInMap.get(vet.entry_id) || [];
        list.push(vet);
        vetInMap.set(vet.entry_id, list);
      }

      // Batch load VET_IN timing records without inspection
      const allPendingVetIns = await db.getAllAsync<{ id: string; entry_id: string; recorded_at: string }>(
        "SELECT id, entry_id, recorded_at FROM timing_records WHERE record_type = 'VET_IN' AND is_void = 0;",
      );
      const pendingVetInMap = new Map<string, { id: string; recorded_at: string }>();
      for (const p of allPendingVetIns) {
        pendingVetInMap.set(p.entry_id, p);
      }

      const pending: PendingVetItem[] = [];
      const attended: AttendedVetItem[] = [];
      const nowIso = new Date().toISOString();

      for (const entryItem of allEntries) {
        const arrivalRecordedAt = arrivalMap.get(entryItem.id);
        const vetInRecs = vetInMap.get(entryItem.id);

        if (vetInRecs && vetInRecs.length > 0) {
          const lastVet = vetInRecs[0];
          const savedDate = new Date(lastVet.vet_created_at || lastVet.vet_in_recorded_at);
          const savedTimeHHMMSS = savedDate.toLocaleTimeString("es-UY", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            hour12: false,
          });

          attended.push({
            entry: entryItem,
            inspection: {
              id: lastVet.vet_id,
              timing_record_id: lastVet.timing_record_id,
              heart_rate: lastVet.heart_rate,
              attempt_number: lastVet.attempt_number || 1,
              is_recheck_required: lastVet.is_recheck_required || 0,
              created_at: lastVet.vet_created_at || nowIso,
            },
            timingRecord: {
              id: lastVet.timing_record_id,
              recorded_at: lastVet.vet_in_recorded_at,
            },
            savedTimeHHMMSS,
          });
        } else {
          const pendingVetIn = pendingVetInMap.get(entryItem.id);

          const isVetCheckStatus =
            (entryItem.status as string) === ParticipantStatus.VET_CHECK ||
            (entryItem.status as string) === "VET_CHECK";

          if (pendingVetIn && isVetCheckStatus) {
            const vetInDate = new Date(pendingVetIn.recorded_at);
            const arrivalDate = arrivalRecordedAt
              ? new Date(arrivalRecordedAt)
              : vetInDate;

            const calcArrHHMMSS = arrivalDate.toLocaleTimeString("es-UY", {
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
              hour12: false,
            });
            const nextVetControlTime = vetInDate.toLocaleTimeString("es-UY", {
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
              hour12: false,
            });

            const isRecheckActive = !!rowRequiresRecheck[entryItem.id];
            const currentHrInput = rowHeartRate[entryItem.id] || "";

            pending.push({
              entry: entryItem,
              calcArrHHMMSS,
              nextVetControlTime,
              arrivalIso: arrivalDate.toISOString(),
              vetInRecordId: pendingVetIn.id,
              heartRateInput: currentHrInput,
              requiresRecheck: isRecheckActive,
            });
          }
        }
      }

      // Sort Attended List: Descending by saved time
      attended.sort((a, b) => {
        const tA = new Date(a.inspection.created_at).getTime();
        const tB = new Date(b.inspection.created_at).getTime();
        return tB - tA;
      });

      // Sort Pending List:
      // Regular pending: Ascending by nextVetControlTime
      // Recheck pending: Ascending by nextVetControlTime, placed at END of list
      const regularPending = pending
        .filter((p) => !p.requiresRecheck)
        .sort((a, b) => a.nextVetControlTime.localeCompare(b.nextVetControlTime));

      const recheckPending = pending
        .filter((p) => p.requiresRecheck)
        .sort((a, b) => a.nextVetControlTime.localeCompare(b.nextVetControlTime));

      setPendingList([...regularPending, ...recheckPending]);
      setAttendedList(attended);
    } catch (e) {
      console.error("[VetGateScreen] Error loading simple tables state:", e);
    }
  };

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
        console.warn("[VetGateScreen] Error querying errors count:", err);
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
  const searchInputRef = useRef<TextInput>(null);

  // Search & matching states
  const [bibSearch, setBibSearch] = useState(
    entry ? entry.bib_number.toString() : "",
  );
  const [matchedEntry, setMatchedEntry] =
    useState<LocalCompetitionEntry | null>(entry || null);

  // Clinical parameters states
  const [heartRate, setHeartRate] = useState<string>("");
  const [temperature, setTemperature] = useState<string | null>(null);
  const [motricity, setMotricity] = useState<MotricityStatus>(
    MotricityStatus.APTO,
  );
  const [metabolic, setMetabolic] = useState<ClinicalStatus>(
    ClinicalStatus.NORMAL,
  );
  const [attempt, setAttempt] = useState<number>(1);
  const [notes, setNotes] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [requiresRecheck, setRequiresRecheck] = useState(false);
  const [inspectionMode, setInspectionMode] = useState<"SIMPLE" | "DETAILED">("SIMPLE");

  useEffect(() => {
    if (inspectionMode === "SIMPLE") {
      loadSimpleTablesState();
    }
  }, [inspectionMode, rowRequiresRecheck]);

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
  const parsedTemp = null;

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
        let found = await db.getFirstAsync<LocalCompetitionEntry>(
          "SELECT * FROM competition_entries WHERE bib_number = ?;",
          [bibInt],
        );

        if (!found) {
          // Competidor no existía en SQLite: Crear registro provisional de contingencia
          const sampleEntry = await db.getFirstAsync<LocalCompetitionEntry>(
            "SELECT competition_id, current_stage_id, tenant_id FROM competition_entries LIMIT 1;",
          );
          const compId = sampleEntry?.competition_id || "77777777-7777-7777-7777-777777777777";
          const stageId = sampleEntry?.current_stage_id || "";
          const tenantId = sampleEntry?.tenant_id || "77777777-7777-7777-7777-777777777777";
          const now = new Date().toISOString();
          const tempId = `temp-entry-${bibInt}-${Date.now()}`;

          await db.runAsync(
            `INSERT INTO competition_entries (
              id, tenant_id, competition_id, rider_id, rider_name, horse_id, horse_name,
              bib_number, status, current_stage_id, ballast_weight, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?);`,
            [
              tempId,
              tenantId,
              compId,
              `rider-${bibInt}`,
              `Jinete ${bibInt}`,
              `horse-${bibInt}`,
              `Equino ${bibInt}`,
              bibInt,
              ParticipantStatus.VET_CHECK,
              stageId,
              now,
              now,
            ],
          );

          found = await db.getFirstAsync<LocalCompetitionEntry>(
            "SELECT * FROM competition_entries WHERE bib_number = ?;",
            [bibInt],
          );
        }

        setMatchedEntry(found || null);
      } catch (e) {
        console.error("[VetGateScreen] Database lookup error:", e);
        setMatchedEntry(null);
      }
    };

    lookupBib();
  }, [bibSearch]);

  const loadEntryState = async () => {
    if (matchedEntry?.vet_inspection_mode) {
      setInspectionMode(matchedEntry.vet_inspection_mode);
    }

    if (!matchedEntry) {
      setIsEnabled(false);
      setBlockMessage("Seleccione o ingrese un dorsal para comenzar.");
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const db = await getDatabase();
      let rows = await db.getAllAsync<any>(
        `SELECT tr.id as timing_record_id, tr.is_approved, tr.recorded_at, vi.id as vet_inspection_id, vi.heart_rate, vi.temperature, vi.motricity, vi.metabolic, vi.attempt_number, vi.is_recheck_required, vi.notes
         FROM timing_records tr
         LEFT JOIN vet_inspections vi ON vi.timing_record_id = tr.id
         WHERE tr.entry_id = ? AND tr.stage_id = ? AND tr.record_type = 'VET_IN' AND tr.is_void = 0
         ORDER BY vi.attempt_number ASC;`,
        [matchedEntry.id, matchedEntry.current_stage_id],
      );

      // Check if VET_IN milestone exists, if not auto-create it to unblock vet officer
      if (rows.length === 0) {
        const now = new Date().toISOString();
        const autoVetInId = `tr-vetin-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
        await db.runAsync(
          `INSERT INTO timing_records (
            id, tenant_id, entry_id, stage_id, record_type, recorded_at, is_approved, is_void, created_at, updated_at
          ) VALUES (?, ?, ?, ?, 'VET_IN', ?, 1, 0, ?, ?);`,
          [
            autoVetInId,
            matchedEntry.tenant_id,
            matchedEntry.id,
            matchedEntry.current_stage_id,
            now,
            now,
            now,
          ],
        );
        rows = await db.getAllAsync<any>(
          `SELECT tr.id as timing_record_id, tr.is_approved, tr.recorded_at, vi.id as vet_inspection_id, vi.heart_rate, vi.temperature, vi.motricity, vi.metabolic, vi.attempt_number, vi.is_recheck_required, vi.notes
           FROM timing_records tr
           LEFT JOIN vet_inspections vi ON vi.timing_record_id = tr.id
           WHERE tr.entry_id = ? AND tr.stage_id = ? AND tr.record_type = 'VET_IN' AND tr.is_void = 0
           ORDER BY vi.attempt_number ASC;`,
          [matchedEntry.id, matchedEntry.current_stage_id],
        );
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

        // Reset requiresRecheck toggle
        setRequiresRecheck(false);

        // Clear inputs for editing
        setHeartRate("");
        setTemperature(null);
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
        setTemperature(last.temperature ? String(last.temperature) : null);
        setMotricity(last.motricity || MotricityStatus.APTO);
        setMetabolic(last.metabolic || ClinicalStatus.NORMAL);
        setNotes(last.notes || "");

        const firstInspection = rows.find((r) => r.attempt_number === 1);
        if (firstInspection && firstInspection.is_recheck_required === 1) {
          setRecheckAllowed(true);
          setRequiresRecheck(true);
        } else {
          setRecheckAllowed(false);
          setRequiresRecheck(false);
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
        setTemperature(first.temperature ? String(first.temperature) : null);
        setMotricity(first.motricity || MotricityStatus.APTO);
        setMetabolic(first.metabolic || ClinicalStatus.NORMAL);
        setNotes(first.notes || "");
        setIsReadOnly(true);
      } else {
        setHeartRate("");
        setTemperature(null);
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
        setTemperature(second.temperature ? String(second.temperature) : null);
        setMotricity(second.motricity || MotricityStatus.APTO);
        setMetabolic(second.metabolic || ClinicalStatus.NORMAL);
        setNotes(second.notes || "");
        setIsReadOnly(true);
      } else {
        setHeartRate("");
        setTemperature(null);
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
      } else if (
        parsedHr > HEART_RATE_LIMIT ||
        (requiresRecheck && attempt === 1)
      ) {
        if (attempt === 1) {
          // High pulse attempt 1 or manual requires recheck -> mark for recheck
          targetStatus = ParticipantStatus.VET_CHECK;
          isRecheckRequired = 1;
        } else {
          // High pulse attempt 2 -> Metabolic elimination
          if (parsedHr > HEART_RATE_LIMIT) {
            targetStatus = ParticipantStatus.DQ;
            isApproved = 0;
            eliminationType = EliminationCode.METABOLIC;
            eliminationReason = `Frecuencia cardíaca excedida (${parsedHr} ppm) tras el segundo intento en Vet Gate. Límite: ${HEART_RATE_LIMIT} ppm.`;
          }
        }
      }

      let nextCheckTimeISO: string | null = null;
      if (isRecheckRequired === 1) {
        const nextCheckDate = new Date(
          presentationTime.getTime() + 20 * 60 * 1000,
        );
        nextCheckTimeISO = nextCheckDate.toISOString();
      }

      let isOnlineSuccess = false;
      let syncMsg = "";

      // Paso 1 (Intento Online Directo): Disparar llamado directo a ApiService
      try {
        const directPayload = {
          timingRecordId: vetInRecord.timing_record_id,
          heartRate: parsedHr,
          motricity: String(motricity),
          metabolic: String(metabolic),
          notes: notes && notes.trim() !== "" ? notes.trim() : undefined,
        };
        await ApiService.postVetInspectionDirect(directPayload);
        isOnlineSuccess = true;
        syncMsg = "Registrado en Tiempo Real (Online)";
        console.log("[Online-First] Direct vet inspection POST succeeded.");
      } catch (onlineErr: any) {
        if (!SyncService.isNetworkError(onlineErr)) {
          // Servidor devolvió un error HTTP explícito
          const apiMsg =
            onlineErr?.response?.data?.message ||
            onlineErr?.message ||
            "Error del servidor.";
          Alert.alert(
            "Error del Servidor",
            Array.isArray(apiMsg) ? apiMsg.join(", ") : String(apiMsg),
          );
          setIsSubmitting(false);
          return;
        }
        // Fallo por red/timeout -> Respaldo Offline
        isOnlineSuccess = false;
        syncMsg = "Conexión no disponible. Registrado en Respaldo Offline";
        console.warn(
          "[Online-First] Direct vet inspection POST failed due to network/timeout. Falling back to SQLite + sync_queue.",
        );
      }

      // Paso 2: Persistencia local en SQLite (espejo en consulta en caso online, o fuente local en caso offline)
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

      await db.runAsync(
        `INSERT INTO vet_inspections (
          id, tenant_id, timing_record_id, heart_rate, temperature, motricity, metabolic, attempt_number, is_recheck_required, next_check_time, notes, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
        [
          vetId,
          tenantId,
          vetInRecord.timing_record_id,
          parsedHr,
          null,
          motricity,
          metabolic,
          attempt,
          isRecheckRequired,
          nextCheckTimeISO,
          notes || null,
          now,
        ],
      );

      await db.runAsync(
        `UPDATE competition_entries SET status = ?, updated_at = ? WHERE id = ?;`,
        [targetStatus, now, matchedEntry.id],
      );

      console.log(
        "[SQLite] Local database updated with vet inspection metrics." +
          (isRecheckRequired ? ` Next check time: ${nextCheckTimeISO}` : ""),
      );

      // Paso 3 (Captura de Fallo / Respaldo Offline): Encolar en sync_queue SOLO si falló la llamada Online
      if (!isOnlineSuccess) {
        await SyncService.enqueueAction("UPDATE_TIMING", "timing_records", {
          id: vetInRecord.timing_record_id,
          recordedAt: vetInRecord.recorded_at,
        });

        await SyncService.enqueueAction(
          "CREATE_VET_INSPECTION",
          "vet_inspections",
          {
            id: vetId,
            tenant_id: tenantId,
            timing_record_id: vetInRecord.timing_record_id,
            competitionId: matchedEntry.competition_id,
            vetGateNumber: matchedEntry.current_stage_id ? 1 : 1,
            riderDorsal: String(matchedEntry.bib_number),
            arrivalTime: arrivalTime
              ? arrivalTime.toISOString()
              : presentationTime.toISOString(),
            vetInTime: presentationTime.toISOString(),
            heartRate: parsedHr,
            gaitStatus:
              motricity === MotricityStatus.APTO
                ? "APPROVED"
                : "LAMENESS_ELIMINATED",
            inspectionType:
              attempt === 2 ? "RE_INSPECTION_MANDATORY" : "STANDARD",
            requiresRecheck: isRecheckRequired === 1,
            nextCheckTime: nextCheckTimeISO || undefined,
            notes: notes || "",
            created_at: now,
          },
        );

        await SyncService.enqueueAction(
          "UPDATE_ENTRY_STATUS",
          "competition_entries",
          {
            id: matchedEntry.id,
            status: targetStatus,
          },
        );
      }

      // User Alert feedback
      let statusHeading = "Inspección Aprobada";
      let statusDetails = `Caballo apto. Pasa a neutralización (Resting).`;
      if (isRecheckRequired === 1) {
        statusHeading = "Rechequeo Requerido";
        statusDetails = `Se requiere re-evaluar al caballo antes del tiempo límite (${nextCheckTimeISO ? new Date(nextCheckTimeISO).toLocaleTimeString() : "20 min"}).`;
      } else if (targetStatus === ParticipantStatus.DQ) {
        statusHeading = "🛑 ELIMINACIÓN REGLAMENTARIA";
        statusDetails =
          eliminationType === EliminationCode.GAIT
            ? "Descalificado por Claudicación (Cojera)."
            : eliminationType === EliminationCode.TIME
              ? `Fuera de tiempo de recuperación (${diffMinutes} min).`
              : `Descalificado por Falla Metabólica (${parsedHr} ppm en Intento 2).`;
      }

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
              setTemperature(null);
              setMotricity(MotricityStatus.APTO);
              setMetabolic(ClinicalStatus.NORMAL);
              setNotes("");
              setRequiresRecheck(false);

              if (onInspectionSuccess) {
                onInspectionSuccess();
              }
              loadEntryState();
              loadSimpleTablesState();

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

  const handleSaveRowSimple = async (item: PendingVetItem) => {
    const entryItem = item.entry;
    const hrStr = rowHeartRate[entryItem.id] ?? item.heartRateInput;
    const hrVal = parseInt(hrStr, 10);

    if (isNaN(hrVal) || hrVal <= 0) {
      Alert.alert(
        "Datos Requeridos",
        `Ingrese una frecuencia cardíaca válida para el dorsal #${entryItem.bib_number}.`,
      );
      return;
    }

    const isRecheck = rowRequiresRecheck[entryItem.id] ?? item.requiresRecheck;
    const now = new Date();
    const nowIso = now.toISOString();
    const isOnlineNow = SyncService.isOnline();

    setRowSavingId(entryItem.id);

    try {
      const db = await getDatabase();

      let vetInRecord = await db.getFirstAsync<any>(
        "SELECT * FROM timing_records WHERE entry_id = ? AND record_type = 'VET_IN' AND is_void = 0 ORDER BY recorded_at DESC;",
        [entryItem.id],
      );

      if (!vetInRecord) {
        const vetInId = `tr-vetin-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
        await db.runAsync(
          `INSERT INTO timing_records (
            id, tenant_id, entry_id, stage_id, record_type, recorded_at, is_approved, is_void, created_at, updated_at
          ) VALUES (?, ?, ?, ?, 'VET_IN', ?, 1, 0, ?, ?);`,
          [
            vetInId,
            entryItem.tenant_id,
            entryItem.id,
            entryItem.current_stage_id,
            nowIso,
            nowIso,
            nowIso,
          ],
        );
        vetInRecord = {
          id: vetInId,
          tenant_id: entryItem.tenant_id,
          entry_id: entryItem.id,
          stage_id: entryItem.current_stage_id,
          record_type: TimeRecordType.VET_IN,
          recorded_at: nowIso,
          is_approved: 1,
          is_void: 0,
          created_at: nowIso,
          updated_at: nowIso,
        };
      }

      const vetId = `vet-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
      let targetStatus = isRecheck ? ParticipantStatus.VET_CHECK : ParticipantStatus.RESTING;

      if (hrVal > HEART_RATE_LIMIT && !isRecheck) {
        targetStatus = ParticipantStatus.VET_CHECK;
      }

      let isOnlineSuccess = false;

      if (isOnlineNow) {
        try {
          const directPayload = {
            timingRecordId: vetInRecord.id,
            heartRate: hrVal,
            motricity: String(MotricityStatus.APTO),
            metabolic: String(ClinicalStatus.NORMAL),
            notes: isRecheck ? "Rechequeo requerido" : undefined,
          };
          await ApiService.postVetInspectionDirect(directPayload);
          isOnlineSuccess = true;
        } catch (onlineErr: any) {
          if (!SyncService.isNetworkError(onlineErr)) {
            const apiMsg =
              onlineErr?.response?.data?.message ||
              onlineErr?.message ||
              "Error del servidor";
            Alert.alert("Error de Servidor", Array.isArray(apiMsg) ? apiMsg.join(", ") : String(apiMsg));
            setRowSavingId(null);
            return;
          }
          isOnlineSuccess = false;
        }
      }

      // Persist to local SQLite
      await db.runAsync(
        `INSERT INTO vet_inspections (
          id, tenant_id, timing_record_id, heart_rate, temperature, motricity, metabolic, attempt_number, is_recheck_required, next_check_time, notes, created_at
        ) VALUES (?, ?, ?, ?, null, ?, ?, 1, ?, null, ?, ?);`,
        [
          vetId,
          entryItem.tenant_id,
          vetInRecord.id,
          hrVal,
          MotricityStatus.APTO,
          ClinicalStatus.NORMAL,
          isRecheck ? 1 : 0,
          isRecheck ? "Rechequeo activado" : null,
          nowIso,
        ],
      );

      await db.runAsync(
        `UPDATE competition_entries SET status = ?, updated_at = ? WHERE id = ?;`,
        [targetStatus, nowIso, entryItem.id],
      );

      if (!isOnlineSuccess) {
        await SyncService.enqueueAction("CREATE_VET_INSPECTION", "vet_inspections", {
          id: vetId,
          tenant_id: entryItem.tenant_id,
          timing_record_id: vetInRecord.id,
          heart_rate: hrVal,
          motricity: MotricityStatus.APTO,
          metabolic: ClinicalStatus.NORMAL,
          attempt_number: 1,
          is_recheck_required: isRecheck ? 1 : 0,
          created_at: nowIso,
        });

        await SyncService.enqueueAction("UPDATE_ENTRY_STATUS", "competition_entries", {
          id: entryItem.id,
          status: targetStatus,
        });
      }

      setRowHeartRate((prev) => {
        const copy = { ...prev };
        delete copy[entryItem.id];
        return copy;
      });
      setRowRequiresRecheck((prev) => {
        const copy = { ...prev };
        delete copy[entryItem.id];
        return copy;
      });

      await loadSimpleTablesState();
    } catch (e: any) {
      console.error("[VetGateScreen] Error saving simple row:", e);
      Alert.alert("Error", `No se pudo guardar la inspección del dorsal #${entryItem.bib_number}.`);
    } finally {
      setRowSavingId(null);
    }
  };

  const handleEditAttendedRow = (item: AttendedVetItem) => {
    Alert.alert(
      `Re-evaluar Dorsal #${item.entry.bib_number}`,
      `¿Desea re-evaluar la inspección de #${item.entry.bib_number}? Esto moverá el binomio de regreso a la lista de pendientes para su corrección.`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Re-evaluar",
          onPress: async () => {
            try {
              const db = await getDatabase();
              await db.runAsync("DELETE FROM vet_inspections WHERE id = ?;", [item.inspection.id]);
              setRowHeartRate((prev) => ({ ...prev, [item.entry.id]: String(item.inspection.heart_rate || "") }));
              setRowRequiresRecheck((prev) => ({ ...prev, [item.entry.id]: item.inspection.is_recheck_required === 1 }));
              await loadSimpleTablesState();
            } catch (e) {
              console.error("Error reverting inspection for edit:", e);
            }
          },
        },
      ],
    );
  };

  if (loading) {
    return (
      <SafeAreaView
        style={[
          styles.container,
          {
            justifyContent: "center",
            alignItems: "center",
            flex: 1,
            backgroundColor: colors.equusBg,
          },
        ]}
      >
        <ActivityIndicator size="large" color={colors.equusGreen} />
      </SafeAreaView>
    );
  }

  const showBackButton = onBack && user?.role !== UserRole.VET;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.equusBg }}>
      <ScrollView contentContainerStyle={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            {showBackButton && (
              <TouchableOpacity style={styles.backButton} onPress={onBack}>
                <Text style={styles.backText}> Volver</Text>
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
          <Text style={styles.title}>Mesa Veterinaria</Text>
        </View>

        {/* Mode Selector Segment Bar */}
        <View style={styles.modeSegmentContainer}>
          <TouchableOpacity
            style={[
              styles.modeSegmentBtn,
              inspectionMode === "SIMPLE" && styles.modeSegmentBtnActive,
            ]}
            onPress={() => setInspectionMode("SIMPLE")}
          >
            <Text
              style={[
                styles.modeSegmentText,
                inspectionMode === "SIMPLE" && styles.modeSegmentTextActive,
              ]}
            >
              ⚡ Ingreso Simple (Mesa)
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.modeSegmentBtn,
              inspectionMode === "DETAILED" && styles.modeSegmentBtnActive,
            ]}
            onPress={() => setInspectionMode("DETAILED")}
          >
            <Text
              style={[
                styles.modeSegmentText,
                inspectionMode === "DETAILED" && styles.modeSegmentTextActive,
              ]}
            >
              📋 Extendido (Detallado)
            </Text>
          </TouchableOpacity>
        </View>

        {/* Filter / Search Bar */}
        <View style={styles.searchCard}>
          <Text style={styles.inputLabel}>Filtrar por Dorsal / Bib</Text>
          <TextInput
            ref={searchInputRef}
            style={styles.searchInput}
            placeholder="Ingrese número de dorsal para filtrar (ej. 12)"
            placeholderTextColor="#64748B"
            keyboardType="numeric"
            value={bibSearch}
            onChangeText={setBibSearch}
          />
        </View>

        {inspectionMode === "SIMPLE" ? (
          /* ── INGRESO VETERINARIO SIMPLE (MESA RÁPIDA DIVIDIDA) ── */
          <View style={{ gap: 20 }}>
            {/* ── SECCIÓN SUPERIOR: Pendientes de Registro ── */}
            <View style={styles.simpleSectionCard}>
              <View style={styles.simpleSectionHeader}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: "#F59E0B" }} />
                  <Text style={styles.simpleSectionTitle}>
                    Pendientes de Registro ({pendingList.filter((item) => !bibSearch.trim() || String(item.entry.bib_number).includes(bibSearch.trim())).length})
                  </Text>
                </View>
                <Text style={styles.simpleSectionSubtitle}>
                  Ordenado por Hora Entrada VET (Llegada + 20m) · Rechequeos al final (Destacados)
                </Text>
              </View>

              {pendingList.filter((item) => !bibSearch.trim() || String(item.entry.bib_number).includes(bibSearch.trim())).length === 0 ? (
                <View style={styles.emptyTableBox}>
                  <Text style={styles.emptyTableText}>
                    ✅ No hay binomios pendientes de registro en mesa.
                  </Text>
                </View>
              ) : (
                pendingList
                  .filter((item) => !bibSearch.trim() || String(item.entry.bib_number).includes(bibSearch.trim()))
                  .map((item) => {
                    const entryItem = item.entry;
                    const isSaving = rowSavingId === entryItem.id;
                    const hrVal = rowHeartRate[entryItem.id] ?? item.heartRateInput;
                    const isRecheckVal = rowRequiresRecheck[entryItem.id] ?? item.requiresRecheck;

                    return (
                      <View
                        key={entryItem.id}
                        style={[
                          styles.pendingRowCard,
                          isRecheckVal && styles.pendingRowCardRecheck,
                        ]}
                      >
                        {/* Row Header Info */}
                        <View style={styles.rowInfoGrid}>
                          <View style={styles.bibCol}>
                            <Text style={styles.bibText}>#{entryItem.bib_number}</Text>
                          </View>
                          <View style={styles.nameCol}>
                            <Text style={styles.horseText}>🐴 {entryItem.horse_name}</Text>
                            <Text style={styles.riderText}>👤 {entryItem.rider_name}</Text>
                          </View>
                          <View style={styles.timeCol}>
                            <Text style={styles.timeLabel}>Hora Entrada VET</Text>
                            <Text style={styles.timeValue}>{item.nextVetControlTime}</Text>
                          </View>
                        </View>

                        {/* Row Action Controls */}
                        <View style={styles.rowControlsRow}>
                          {/* Heart Rate Input */}
                          <View style={styles.inlineHrBox}>
                            <Text style={styles.inlineLabel}>Pulso (PPM):</Text>
                            <TextInput
                              style={styles.inlineHrInput}
                              placeholder="00"
                              keyboardType="numeric"
                              maxLength={3}
                              value={hrVal}
                              onChangeText={(text) => {
                                const sanitized = text.replace(/[^0-9]/g, "");
                                setRowHeartRate((prev) => ({ ...prev, [entryItem.id]: sanitized }));
                              }}
                            />
                          </View>

                          {/* Requires Recheck Checkbox */}
                          <TouchableOpacity
                            style={[
                              styles.recheckCheckboxBtn,
                              isRecheckVal && styles.recheckCheckboxBtnActive,
                            ]}
                            onPress={() => {
                              setRowRequiresRecheck((prev) => ({
                                ...prev,
                                [entryItem.id]: !isRecheckVal,
                              }));
                            }}
                          >
                            <Text
                              style={[
                                styles.recheckCheckboxText,
                                isRecheckVal && styles.recheckCheckboxTextActive,
                              ]}
                            >
                              {isRecheckVal ? "🟡 RECHEQUEO" : "⬜ Rechequeo"}
                            </Text>
                          </TouchableOpacity>

                          {/* Save Button */}
                          <TouchableOpacity
                            style={[
                              styles.saveRowBtn,
                              isSaving && styles.saveRowBtnDisabled,
                            ]}
                            onPress={() => handleSaveRowSimple(item)}
                            disabled={isSaving}
                          >
                            {isSaving ? (
                              <ActivityIndicator size="small" color="#FFFFFF" />
                            ) : (
                              <Text style={styles.saveRowBtnText}>💾 Guardar</Text>
                            )}
                          </TouchableOpacity>
                        </View>
                      </View>
                    );
                  })
              )}
            </View>

            {/* ── SECCIÓN INFERIOR: Registrados (Atendidos en Mesa) ── */}
            <View style={styles.simpleSectionCard}>
              <View style={styles.simpleSectionHeader}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: "#10B981" }} />
                  <Text style={styles.simpleSectionTitle}>
                    Atendidos en Mesa ({attendedList.filter((item) => !bibSearch.trim() || String(item.entry.bib_number).includes(bibSearch.trim())).length})
                  </Text>
                </View>
                <Text style={styles.simpleSectionSubtitle}>
                  Ordenado por Hora de Guardado (Más recientes primero)
                </Text>
              </View>

              {attendedList.filter((item) => !bibSearch.trim() || String(item.entry.bib_number).includes(bibSearch.trim())).length === 0 ? (
                <View style={styles.emptyTableBox}>
                  <Text style={styles.emptyTableText}>
                    No hay binomios registrados en mesa aún.
                  </Text>
                </View>
              ) : (
                attendedList
                  .filter((item) => !bibSearch.trim() || String(item.entry.bib_number).includes(bibSearch.trim()))
                  .map((item) => {
                    const entryItem = item.entry;
                    const ins = item.inspection;
                    const isRecheck = ins.is_recheck_required === 1;

                    return (
                      <View key={ins.id || entryItem.id} style={styles.attendedRowCard}>
                        <View style={styles.rowInfoGrid}>
                          <View style={styles.bibCol}>
                            <Text style={styles.bibTextDone}>#{entryItem.bib_number}</Text>
                          </View>
                          <View style={styles.nameCol}>
                            <Text style={styles.horseText}>🐴 {entryItem.horse_name}</Text>
                            <Text style={styles.riderText}>👤 {entryItem.rider_name}</Text>
                          </View>
                          <View style={styles.attendedStatusCol}>
                            <Text style={styles.pulseBadge}>
                              ❤️ {ins.heart_rate} PPM
                            </Text>
                            <Text
                              style={[
                                styles.recheckStatusBadge,
                                isRecheck ? styles.badgeWarning : styles.badgeSuccess,
                              ]}
                            >
                              {isRecheck ? "🟡 RECHEQUEO" : "🟢 APTO"}
                            </Text>
                          </View>
                          <View style={styles.timeCol}>
                            <Text style={styles.timeLabel}>Guardado</Text>
                            <Text style={styles.timeValueDone}>{item.savedTimeHHMMSS}</Text>
                          </View>
                        </View>

                        <View style={styles.attendedActionsRow}>
                          <TouchableOpacity
                            style={styles.editRowBtn}
                            onPress={() => handleEditAttendedRow(item)}
                          >
                            <Text style={styles.editRowBtnText}>✏️ Corregir / Re-evaluar</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    );
                  })
              )}
            </View>
          </View>
        ) : (
          /* ── INGRESO VETERINARIO DETALLADO (EXTENDIDO) ── */
          <View style={{ gap: 16 }}>
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

                  {/* Requires Recheck Toggle */}
                  {!isReadOnly && attempt === 1 && (
                    <View style={styles.toggleRow}>
                      <Text style={styles.inputLabel}>¿Requerir Rechequeo?</Text>
                      <TouchableOpacity
                        style={[
                          styles.toggleBtn,
                          requiresRecheck
                            ? styles.toggleBtnActive
                            : styles.toggleBtnInactive,
                        ]}
                        onPress={() => setRequiresRecheck(!requiresRecheck)}
                      >
                        <Text
                          style={[
                            styles.toggleText,
                            {
                              color: requiresRecheck
                                ? colors.white
                                : colors.equusText,
                            },
                          ]}
                        >
                          {requiresRecheck ? "SÍ" : "NO"}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  )}

                  {isReadOnly && attempt === 1 && requiresRecheck && (
                    <View style={styles.toggleRow}>
                      <Text style={styles.inputLabel}>¿Requerir Rechequeo?:</Text>
                      <Text style={[styles.statusValue, { color: colors.warning }]}>
                        SÍ
                      </Text>
                    </View>
                  )}

                  {/* Attempt Number Selector */}
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Número de Intento (FEU)</Text>
                    <View style={styles.segmentSelector}>
                      {[1, 2].map((num) => {
                        const isDisabled =
                          num === 2 && !recheckAllowed && !requiresRecheck;
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
                                  "El Intento 2 solo se habilita si el Intento 1 requiere rechequeo (pulso superado o activado manualmente).",
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
                  <Text style={styles.cardSectionTitle}>
                    EVALUACIÓN FISIOLÓGICA
                  </Text>

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
                                val === "APTO" && {
                                  backgroundColor: colors.success,
                                },
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
                              isSelected && {
                                backgroundColor: colors.equusGreen,
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
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
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
    justifyContent: "space-between",
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
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
    paddingVertical: 4,
  },
  toggleBtn: {
    width: 80,
    height: 38,
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  toggleBtnActive: {
    backgroundColor: colors.warning,
    borderColor: colors.warning,
  },
  toggleBtnInactive: {
    backgroundColor: colors.inputBg,
    borderColor: colors.border,
  },
  toggleText: {
    fontSize: 14,
    fontWeight: "800",
  },
  modeSegmentContainer: {
    flexDirection: "row",
    backgroundColor: "#F1F5F9",
    borderRadius: 12,
    padding: 4,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modeSegmentBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  modeSegmentBtnActive: {
    backgroundColor: colors.equusGreen,
  },
  modeSegmentText: {
    fontSize: 13,
    fontWeight: "800",
    color: colors.equusText,
  },
  modeSegmentTextActive: {
    color: colors.white,
  },
  simpleEvaluationRow: {
    flexDirection: "row",
    gap: 8,
  },
  simpleEvalBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.inputBg,
    alignItems: "center",
    justifyContent: "center",
  },
  simpleEvalBtnApto: {
    backgroundColor: colors.success,
    borderColor: colors.success,
  },
  simpleEvalBtnRecheck: {
    backgroundColor: colors.warning,
    borderColor: colors.warning,
  },
  simpleEvalBtnNoApto: {
    backgroundColor: colors.danger,
    borderColor: colors.danger,
  },
  simpleEvalText: {
    fontSize: 13,
    fontWeight: "800",
    color: colors.equusText,
  },
  simpleEvalTextActive: {
    color: colors.white,
  },
  simpleSectionCard: {
    backgroundColor: colors.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
    marginBottom: 16,
  },
  simpleSectionHeader: {
    backgroundColor: "#0F172A",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#1E293B",
  },
  simpleSectionTitle: {
    color: "#F8FAFC",
    fontSize: 14,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
  simpleSectionSubtitle: {
    color: "#94A3B8",
    fontSize: 11,
    fontWeight: "700",
    marginTop: 2,
  },
  emptyTableBox: {
    padding: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F8FAFC",
  },
  emptyTableText: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "700",
  },
  pendingRowCard: {
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    padding: 14,
  },
  pendingRowCardRecheck: {
    backgroundColor: "#FEE2E2",
    borderColor: "#EF4444",
    borderWidth: 1.5,
    borderRadius: 8,
    margin: 8,
    marginBottom: 0,
  },
  rowInfoGrid: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  bibCol: {
    width: 60,
  },
  bibText: {
    fontSize: 20,
    fontWeight: "900",
    color: colors.equusGreen,
  },
  bibTextDone: {
    fontSize: 20,
    fontWeight: "900",
    color: "#64748B",
  },
  nameCol: {
    flex: 1,
    paddingHorizontal: 8,
  },
  horseText: {
    fontSize: 14,
    fontWeight: "800",
    color: colors.equusText,
  },
  riderText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.muted,
    marginTop: 2,
  },
  timeCol: {
    alignItems: "flex-end",
  },
  timeLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: colors.muted,
  },
  timeValue: {
    fontSize: 14,
    fontWeight: "900",
    color: "#D97706",
  },
  timeValueDone: {
    fontSize: 13,
    fontWeight: "800",
    color: "#059669",
  },
  rowControlsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    marginTop: 4,
  },
  inlineHrBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F1F5F9",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 8,
    height: 42,
  },
  inlineLabel: {
    fontSize: 12,
    fontWeight: "800",
    color: colors.equusText,
    marginRight: 6,
  },
  inlineHrInput: {
    width: 45,
    height: 38,
    fontSize: 16,
    fontWeight: "900",
    color: colors.equusText,
    textAlign: "center",
  },
  recheckCheckboxBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "#F8FAFC",
  },
  recheckCheckboxBtnActive: {
    backgroundColor: "#FEF3C7",
    borderColor: "#F59E0B",
  },
  recheckCheckboxText: {
    fontSize: 12,
    fontWeight: "800",
    color: colors.equusText,
  },
  recheckCheckboxTextActive: {
    color: "#92400E",
  },
  saveRowBtn: {
    backgroundColor: colors.equusGreen,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  saveRowBtnDisabled: {
    opacity: 0.6,
  },
  saveRowBtnText: {
    color: colors.white,
    fontSize: 13,
    fontWeight: "900",
  },
  attendedRowCard: {
    backgroundColor: "#F8FAFC",
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    padding: 14,
  },
  attendedStatusCol: {
    alignItems: "center",
    paddingHorizontal: 8,
  },
  pulseBadge: {
    fontSize: 13,
    fontWeight: "900",
    color: "#1E293B",
  },
  recheckStatusBadge: {
    fontSize: 10,
    fontWeight: "900",
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 4,
    marginTop: 2,
  },
  badgeSuccess: {
    backgroundColor: "#D1FAE5",
    color: "#065F46",
  },
  badgeWarning: {
    backgroundColor: "#FEF3C7",
    color: "#92400E",
  },
  attendedActionsRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 6,
  },
  editRowBtn: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 6,
    backgroundColor: "#E2E8F0",
  },
  editRowBtnText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#334155",
  },
});
