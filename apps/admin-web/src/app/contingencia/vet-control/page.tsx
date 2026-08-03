"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useAuthStore } from "@/store/auth.store";
import { TimingService } from "@/services/api/timing.service";
import { CompetitionEntryService } from "@/services/api/competition-entry.service";
import { VetInspectionService } from "@/services/api/vet-inspection.service";
import {
  GaitStatus,
  InspectionType,
  ParticipantStatus,
} from "@equuscronos/shared";

// ─── Interfaces ─────────────────────────────────────────────────────────────
interface Stage {
  id: string;
  stageNumber: number;
  distanceKm: number;
  neutralizationMinutes?: number;
}

interface Competition {
  id: string;
  name: string;
  status: string;
  vetInspectionMode?: "SIMPLE" | "DETAILED";
  stages: Stage[];
}

interface TimingRecord {
  id: string;
  recordType: string;
  recordedAt: string;
  isVoid: boolean;
  stage?: {
    id: string;
    stageNumber: number;
  };
}

interface VetInspectionItem {
  id: string;
  competenceId?: string;
  vetGateNumber: number;
  riderDorsal: string;
  arrivalTime: string;
  vetInTime: string;
  heartRate: number;
  gaitStatus: string;
  inspectionType: string;
  requiresRecheck: boolean;
  notes?: string;
  createdAt?: string;
}

interface CompetitionEntry {
  id: string;
  bibNumber: number;
  status: string;
  rider: { name: string };
  horse: { name: string; owner?: { name: string } };
  timingRecords?: TimingRecord[];
  vetInspections?: VetInspectionItem[];
}

type SubmitStatus = "idle" | "loading" | "success" | "error";

const ALLOWED_ROLES = ["ADMIN", "CLUB_ADMIN", "JUDGE", "TIMEKEEPER"];

// ─── Helpers ────────────────────────────────────────────────────────────────
function localNowHHMMSS(): string {
  const d = new Date();
  return [
    String(d.getHours()).padStart(2, "0"),
    String(d.getMinutes()).padStart(2, "0"),
    String(d.getSeconds()).padStart(2, "0"),
  ].join(":");
}

function formatHHMMSS(dateStr?: string | Date): string {
  if (!dateStr) return localNowHHMMSS();
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return localNowHHMMSS();
  return [
    String(d.getHours()).padStart(2, "0"),
    String(d.getMinutes()).padStart(2, "0"),
    String(d.getSeconds()).padStart(2, "0"),
  ].join(":");
}

function addMinutesToHHMMSS(hhmmss: string, mins: number): string {
  if (!hhmmss || !/^\d{2}:\d{2}:\d{2}$/.test(hhmmss)) return localNowHHMMSS();
  const [h, m, s] = hhmmss.split(":").map(Number);
  const date = new Date();
  date.setHours(h, m + mins, s || 0, 0);
  return [
    String(date.getHours()).padStart(2, "0"),
    String(date.getMinutes()).padStart(2, "0"),
    String(date.getSeconds()).padStart(2, "0"),
  ].join(":");
}

function buildIsoFromTimeInput(hhmmss: string): string {
  const today = new Date().toISOString().substring(0, 10);
  return new Date(`${today}T${hhmmss}`).toISOString();
}

function getMinutesDiff(time1: string, time2: string): number {
  if (!time1 || !time2) return 0;
  const [h1, m1, s1] = time1.split(":").map(Number);
  const [h2, m2, s2] = time2.split(":").map(Number);
  if (isNaN(h1) || isNaN(h2)) return 0;

  let sec1 = h1 * 3600 + (m1 || 0) * 60 + (s1 || 0);
  let sec2 = h2 * 3600 + (m2 || 0) * 60 + (s2 || 0);

  if (sec2 < sec1) {
    sec2 += 24 * 3600;
  }

  return (sec2 - sec1) / 60;
}

// ─── Page Component ─────────────────────────────────────────────────────────
export default function VetControlPage() {
  const user = useAuthStore((s) => s.user);

  // Focus Refs
  const bibInputRef = useRef<HTMLInputElement>(null);
  const vetInTimeRef = useRef<HTMLInputElement>(null);
  const heartRateRef = useRef<HTMLInputElement>(null);
  const gaitStatusRef = useRef<HTMLSelectElement>(null);
  const submitButtonRef = useRef<HTMLButtonElement>(null);

  // State: Competitions & Selected
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [competitionId, setCompetitionId] = useState("");
  const [stageId, setStageId] = useState("");
  const [entries, setEntries] = useState<CompetitionEntry[]>([]);

  // View Mode: "SIMPLE" | "DETAILED"
  const [viewMode, setViewMode] = useState<"SIMPLE" | "DETAILED">("SIMPLE");

  // State: Form Inputs (Detailed Form Mode)
  const [bibNumber, setBibNumber] = useState("");
  const [arrivalTime, setArrivalTime] = useState("");
  const [isArrivalPreFilled, setIsArrivalPreFilled] = useState(false);
  const [vetInTime, setVetInTime] = useState(localNowHHMMSS());
  const [heartRate, setHeartRate] = useState("");
  const [gaitStatus, setGaitStatus] = useState<GaitStatus>(GaitStatus.APPROVED);
  const [inspectionType, setInspectionType] = useState<InspectionType>(
    InspectionType.STANDARD,
  );
  const [requiresRecheck, setRequiresRecheck] = useState(false);
  const [notes, setNotes] = useState("");

  // State: Row inputs for Simple View
  const [rowHeartRate, setRowHeartRate] = useState<Record<string, string>>({});
  const [rowRequiresRecheck, setRowRequiresRecheck] = useState<Record<string, boolean>>({});
  const [rowSavingId, setRowSavingId] = useState<string | null>(null);

  // State: UI Feedback
  const [loadingComps, setLoadingComps] = useState(true);
  const [loadingEntries, setLoadingEntries] = useState(false);
  const [status, setStatus] = useState<SubmitStatus>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<any>(null);

  // Derived state
  const selectedComp = competitions.find((c) => c.id === competitionId);
  const stages: Stage[] = selectedComp?.stages ?? [];
  const selectedStage = stages.find((s) => s.id === stageId);

  // Find active entry matching the typed bib number (Detailed mode)
  const matchedEntry = entries.find(
    (e) => String(e.bibNumber) === bibNumber.trim(),
  );

  const hasAccess = user ? ALLOWED_ROLES.includes(user.role) : false;

  // Load competitions on mount
  const loadCompetitions = useCallback(async () => {
    setLoadingComps(true);
    try {
      const data = await TimingService.getActiveCompetitions();
      setCompetitions(data as Competition[]);
      if (data.length > 0) {
        setCompetitionId(data[0].id);
        const firstComp = data[0] as Competition;
        if (firstComp.vetInspectionMode) {
          setViewMode(firstComp.vetInspectionMode);
        }
        const firstStage = firstComp.stages?.[0];
        if (firstStage) setStageId(firstStage.id);
      }
    } catch (e: any) {
      setErrorMsg(e.message);
    } finally {
      setLoadingComps(false);
    }
  }, []);

  useEffect(() => {
    loadCompetitions();
  }, [loadCompetitions]);

  // Sync viewMode when competition changes
  useEffect(() => {
    if (selectedComp?.vetInspectionMode) {
      setViewMode(selectedComp.vetInspectionMode);
    }
  }, [competitionId, selectedComp]);

  // Load entries when competition changes
  const refreshEntries = useCallback(async () => {
    if (!competitionId) {
      setEntries([]);
      return;
    }
    setLoadingEntries(true);
    try {
      const data = await CompetitionEntryService.getAllByCompetition(competitionId);
      setEntries(data as CompetitionEntry[]);
    } catch (e) {
      console.error("Error cargando binomios:", e);
    } finally {
      setLoadingEntries(false);
    }
  }, [competitionId]);

  useEffect(() => {
    refreshEntries();
  }, [competitionId, refreshEntries]);

  // Reset stage and clear form when competition changes
  useEffect(() => {
    const comp = competitions.find((c) => c.id === competitionId);
    const first = comp?.stages?.[0];
    setStageId(first?.id ?? "");
    clearForm(false);
  }, [competitionId, competitions]);

  // Autocomplete Puesto 1 (Arribo) in detailed mode
  useEffect(() => {
    if (!matchedEntry || !selectedStage) {
      setArrivalTime("");
      setIsArrivalPreFilled(false);
      return;
    }

    const arrivalRecord = matchedEntry.timingRecords?.find(
      (r) =>
        r.recordType === "ARRIVAL" &&
        !r.isVoid &&
        r.stage?.stageNumber === selectedStage.stageNumber,
    );

    if (arrivalRecord) {
      setArrivalTime(formatHHMMSS(arrivalRecord.recordedAt));
      setIsArrivalPreFilled(true);
    } else {
      setArrivalTime("");
      setIsArrivalPreFilled(false);
    }
  }, [matchedEntry, stageId, selectedStage]);

  // Real-time calculations for visual warnings
  const recoveryDiffMinutes =
    selectedStage && arrivalTime && vetInTime
      ? getMinutesDiff(arrivalTime, vetInTime)
      : 0;

  const isRecoveryWarning = recoveryDiffMinutes > 20;
  const isPulseWarning = heartRate ? parseInt(heartRate, 10) > 65 : false;

  // Clear form helper
  const clearForm = (resetBib = true) => {
    if (resetBib) {
      setBibNumber("");
    }
    setArrivalTime("");
    setVetInTime(localNowHHMMSS());
    setHeartRate("");
    setGaitStatus(GaitStatus.APPROVED);
    setInspectionType(InspectionType.STANDARD);
    setRequiresRecheck(false);
    setNotes("");
    setIsArrivalPreFilled(false);

    if (resetBib && bibInputRef.current) {
      bibInputRef.current.focus();
    }
  };

  // Submit Handler (Detailed Form Mode)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setLastResult(null);

    if (!competitionId) {
      setErrorMsg("Debe seleccionar una competencia.");
      return;
    }
    if (!stageId || !selectedStage) {
      setErrorMsg("Debe seleccionar una etapa.");
      return;
    }
    if (!matchedEntry) {
      setErrorMsg(
        "El dorsal ingresado no pertenece a ningún binomio habilitado.",
      );
      return;
    }
    if (!arrivalTime || !/^\d{2}:\d{2}:\d{2}$/.test(arrivalTime)) {
      setErrorMsg(
        "La hora de arribo (Puesto 1) es obligatoria y debe tener formato HH:MM:SS.",
      );
      return;
    }
    if (!vetInTime || !/^\d{2}:\d{2}:\d{2}$/.test(vetInTime)) {
      setErrorMsg(
        "La hora de ingreso (Puesto 2) es obligatoria y debe tener formato HH:MM:SS.",
      );
      return;
    }
    if (
      !heartRate ||
      isNaN(parseInt(heartRate, 10)) ||
      parseInt(heartRate, 10) <= 0
    ) {
      setErrorMsg("Debe ingresar un valor de pulsaciones por minuto válido.");
      return;
    }

    setStatus("loading");
    try {
      const result = await VetInspectionService.create({
        competitionId,
        vetGateNumber: selectedStage.stageNumber,
        riderDorsal: bibNumber.trim(),
        arrivalTime: buildIsoFromTimeInput(arrivalTime),
        vetInTime: buildIsoFromTimeInput(vetInTime),
        heartRate: parseInt(heartRate, 10),
        gaitStatus,
        inspectionType,
        requiresRecheck,
        notes: notes.trim() || undefined,
      });

      setLastResult(result);
      setStatus("success");
      await refreshEntries();
      clearForm(true);
    } catch (err: any) {
      setErrorMsg(
        err.message || "Error al procesar la inspección veterinaria.",
      );
      setStatus("error");
    }
  };

  // Submit Handler for Simple Fast-Entry Table Row
  const handleSaveRowSimple = async (entry: CompetitionEntry, calcArrHHMMSS: string) => {
    if (!selectedStage) return;
    const hrStr = rowHeartRate[entry.id];
    const hrVal = parseInt(hrStr || "", 10);

    if (isNaN(hrVal) || hrVal <= 0) {
      alert(`Debe ingresar una frecuencia cardíaca válida para el dorsal #${entry.bibNumber}.`);
      return;
    }

    const isRecheck = !!rowRequiresRecheck[entry.id];
    const nowHHMMSS = localNowHHMMSS();
    setRowSavingId(entry.id);
    setErrorMsg(null);

    try {
      await VetInspectionService.create({
        competitionId,
        vetGateNumber: selectedStage.stageNumber,
        riderDorsal: String(entry.bibNumber),
        arrivalTime: buildIsoFromTimeInput(calcArrHHMMSS || nowHHMMSS),
        vetInTime: buildIsoFromTimeInput(nowHHMMSS),
        heartRate: hrVal,
        gaitStatus: GaitStatus.APPROVED,
        inspectionType: isRecheck ? InspectionType.RE_INSPECTION_MANDATORY : InspectionType.STANDARD,
        requiresRecheck: isRecheck,
      });

      // Clear row input state & refresh
      setRowHeartRate((prev) => {
        const copy = { ...prev };
        delete copy[entry.id];
        return copy;
      });
      setRowRequiresRecheck((prev) => {
        const copy = { ...prev };
        delete copy[entry.id];
        return copy;
      });

      await refreshEntries();
    } catch (err: any) {
      alert(`Error al guardar inspección de dorsal #${entry.bibNumber}: ${err.message}`);
    } finally {
      setRowSavingId(null);
    }
  };

  // Keyboard navigation
  const handleKeyDown = (
    e: React.KeyboardEvent,
    nextField: React.RefObject<any>,
  ) => {
    if (e.key === "Enter") {
      e.preventDefault();
      nextField.current?.focus();
      if (nextField === submitButtonRef) {
        nextField.current?.click();
      }
    }
  };

  // ─── Simple Mode Calculations (Vista Dividida) ──────────────────────────
  const currentStageNumber = selectedStage?.stageNumber ?? 1;

  // 1. Binomios con inspección veterinaria guardada para la etapa seleccionada
  const registeredEntriesWithInspections: {
    entry: CompetitionEntry;
    inspection: VetInspectionItem;
  }[] = [];

  // 2. Binomios pendientes de inspección en la etapa seleccionada
  const pendingEntriesList: {
    entry: CompetitionEntry;
    calcArrHHMMSS: string;
    nextVetControlTime: string;
    requiresRecheck: boolean;
  }[] = [];

  for (const entry of entries) {
    const insp = entry.vetInspections?.find(
      (v) => v.vetGateNumber === currentStageNumber,
    );

    if (insp) {
      registeredEntriesWithInspections.push({ entry, inspection: insp });
    } else {
      // Arrival record for this stage
      const arrivalRec = entry.timingRecords?.find(
        (r) =>
          r.recordType === "ARRIVAL" &&
          !r.isVoid &&
          r.stage?.stageNumber === currentStageNumber,
      );

      const calcArr = arrivalRec
        ? formatHHMMSS(arrivalRec.recordedAt)
        : localNowHHMMSS();

      const nextVetTime = arrivalRec
        ? addMinutesToHHMMSS(calcArr, 20)
        : calcArr;

      const isRecheckActive =
        !!rowRequiresRecheck[entry.id] ||
        entry.vetInspections?.some((v) => v.requiresRecheck) ||
        false;

      pendingEntriesList.push({
        entry,
        calcArrHHMMSS: calcArr,
        nextVetControlTime: nextVetTime,
        requiresRecheck: isRecheckActive,
      });
    }
  }

  // Ordenar Registrados (Atendidos en Mesa): Guardados más recientes primero
  registeredEntriesWithInspections.sort((a, b) => {
    const tA = new Date(a.inspection.createdAt || a.inspection.vetInTime).getTime();
    const tB = new Date(b.inspection.createdAt || b.inspection.vetInTime).getTime();
    return tB - tA;
  });

  // Ordenar Pendientes:
  // - Binomios sin rechequeo: Orden ascendente por nextVetControlTime
  // - RECHEQUEO RULE: Binomios con rechequeo pasan al FINAL de la lista superior (estilo arena/dorado)
  const regularPending = pendingEntriesList
    .filter((p) => !p.requiresRecheck)
    .sort((a, b) => a.nextVetControlTime.localeCompare(b.nextVetControlTime));

  const recheckPending = pendingEntriesList
    .filter((p) => p.requiresRecheck)
    .sort((a, b) => a.nextVetControlTime.localeCompare(b.nextVetControlTime));

  const sortedPendingList = [...regularPending, ...recheckPending];

  // ── Render ───────────────────────────────────────────────────────────────
  if (!hasAccess) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] bg-slate-950 text-white">
        <div className="bg-slate-900 border border-red-500/30 rounded-2xl p-8 text-center max-w-md shadow-2xl">
          <div className="w-14 h-14 bg-red-950/50 rounded-full flex items-center justify-center mx-auto mb-4 border border-red-500/20">
            <svg
              className="w-7 h-7 text-red-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v3m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
              />
            </svg>
          </div>
          <h2 className="text-lg font-bold text-red-400 mb-2">
            Acceso Denegado
          </h2>
          <p className="text-sm text-slate-400">
            Esta pantalla requiere rol de{" "}
            <strong>ADMIN, CLUB_ADMIN, JUDGE</strong> o{" "}
            <strong>TIMEKEEPER</strong>.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto p-4 md:p-6 bg-slate-950 text-white rounded-3xl shadow-2xl border border-slate-800">
      {/* ── Header Area ──────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0 w-14 h-14 rounded-2xl bg-emerald-950/80 border border-emerald-500/20 flex items-center justify-center shadow-lg">
            <svg
              className="w-8 h-8 text-emerald-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-extrabold text-slate-100 tracking-tight leading-tight">
              Mesa de Control Veterinario
            </h1>
            <p className="mt-1 text-xs md:text-sm text-slate-400">
              {viewMode === "SIMPLE"
                ? "Modo Rápido FEU: Registro dividida de pendientes y atendidos en mesa."
                : "Modo Extendido: Consola clínica de detalle de trote y parámetros."}
            </p>
          </div>
        </div>

        {/* Controls Header (Competition, Stage, View Switcher) */}
        <div className="flex items-center gap-2">
          {/* Mode Switcher Buttons */}
          <div className="bg-slate-900 border border-slate-800 p-1 rounded-xl flex items-center gap-1">
            <button
              type="button"
              onClick={() => setViewMode("SIMPLE")}
              className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all ${
                viewMode === "SIMPLE"
                  ? "bg-emerald-600 text-white shadow-md"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              ⚡ Vista Rápida (SIMPLE)
            </button>
            <button
              type="button"
              onClick={() => setViewMode("DETAILED")}
              className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all ${
                viewMode === "DETAILED"
                  ? "bg-emerald-600 text-white shadow-md"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              📋 Extendido (DETAILED)
            </button>
          </div>
        </div>
      </div>

      {/* ── Competencia and Checkpoint Selector Banner ─────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-900/80 p-4 rounded-2xl border border-slate-800">
        <div>
          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">
            Competencia Activa
          </label>
          {loadingComps ? (
            <div className="h-10 bg-slate-850 rounded-xl animate-pulse" />
          ) : (
            <select
              value={competitionId}
              onChange={(e) => setCompetitionId(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 font-semibold"
            >
              {competitions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} — {c.status === "ACTIVE" ? "🟢 EN CARRERA" : "📋 Planificada"}{" "}
                  [{c.vetInspectionMode || "SIMPLE"}]
                </option>
              ))}
            </select>
          )}
        </div>

        <div>
          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">
            Etapa / Vet Gate
          </label>
          {stages.length === 0 ? (
            <p className="text-sm text-slate-500 italic py-1">
              No hay etapas configuradas.
            </p>
          ) : (
            <select
              value={stageId}
              onChange={(e) => setStageId(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 font-semibold"
            >
              {stages.map((s) => (
                <option key={s.id} value={s.id}>
                  Etapa {s.stageNumber} — Vet Gate ({s.distanceKm} km)
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* ── MODE 1: VISTA SIMPLE DIVIDIDA (MESA RÁPIDA) ──────────────────── */}
      {viewMode === "SIMPLE" ? (
        <div className="space-y-8">
          {/* SECCIÓN SUPERIOR: Pendientes de Registro */}
          <div className="bg-slate-900/60 rounded-2xl border border-slate-800 overflow-hidden shadow-lg">
            <div className="bg-slate-900 border-b border-slate-800 px-5 py-3.5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="w-3 h-3 rounded-full bg-amber-400 animate-pulse" />
                <h2 className="text-base font-extrabold text-slate-200">
                  SECCIÓN SUPERIOR: Pendientes de Registro en Mesa ({sortedPendingList.length})
                </h2>
              </div>
              <span className="text-xs text-slate-400 font-semibold">
                Ordenado por Hora Entrada VET (`Llegada + 20m`) · Rechequeos al final (Dorado)
              </span>
            </div>

            {loadingEntries ? (
              <div className="p-8 text-center text-slate-500 text-sm font-semibold">
                Cargando binomios pendientes…
              </div>
            ) : sortedPendingList.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-sm font-semibold bg-slate-950/40">
                ✅ Todos los binomios de la etapa han sido atendidos en mesa.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-950 text-slate-400 text-[11px] font-black uppercase tracking-wider border-b border-slate-800">
                    <tr>
                      <th className="px-4 py-3">Dorsal</th>
                      <th className="px-4 py-3">Equino</th>
                      <th className="px-4 py-3">Jinete</th>
                      <th className="px-4 py-3">Propietario</th>
                      <th className="px-4 py-3 text-center">Hora Entrada VET</th>
                      <th className="px-4 py-3 text-center">Pulso (PPM)</th>
                      <th className="px-4 py-3 text-center">Rechequeo</th>
                      <th className="px-4 py-3 text-right">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-medium">
                    {sortedPendingList.map(({ entry, calcArrHHMMSS, nextVetControlTime, requiresRecheck: isRecheckItem }) => {
                      const isSavingThis = rowSavingId === entry.id;
                      const hrVal = rowHeartRate[entry.id] ?? "";
                      const checkVal = rowRequiresRecheck[entry.id] ?? isRecheckItem;

                      return (
                        <tr
                          key={entry.id}
                          className={`transition-colors ${
                            checkVal
                              ? "bg-amber-950/40 hover:bg-amber-950/60 text-amber-100 border-l-4 border-l-amber-400"
                              : "hover:bg-slate-850/50 text-slate-200"
                          }`}
                        >
                          {/* Dorsal */}
                          <td className="px-4 py-3 font-mono font-black text-emerald-400 text-base">
                            #{entry.bibNumber}
                          </td>
                          {/* Equino */}
                          <td className="px-4 py-3 font-bold text-slate-100">
                            {entry.horse?.name || "Sin nombre"}
                          </td>
                          {/* Jinete */}
                          <td className="px-4 py-3 text-slate-300">
                            {entry.rider?.name || "Sin nombre"}
                          </td>
                          {/* Propietario */}
                          <td className="px-4 py-3 text-slate-400 text-xs">
                            {entry.horse?.owner?.name || "Sin registrar"}
                          </td>
                          {/* Hora Entrada VET */}
                          <td className="px-4 py-3 text-center font-mono font-bold text-amber-300">
                            {nextVetControlTime}
                          </td>
                          {/* Pulso (Input) */}
                          <td className="px-4 py-3 text-center">
                            <input
                              type="number"
                              min={30}
                              max={150}
                              placeholder="Ej. 60"
                              value={hrVal}
                              onChange={(e) =>
                                setRowHeartRate((prev) => ({
                                  ...prev,
                                  [entry.id]: e.target.value,
                                }))
                              }
                              className="w-20 px-2 py-1.5 text-center text-sm font-black bg-slate-950 border border-slate-700 rounded-lg text-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 font-mono"
                            />
                          </td>
                          {/* Rechequeo (Checkbox) */}
                          <td className="px-4 py-3 text-center">
                            <input
                              type="checkbox"
                              checked={checkVal}
                              onChange={(e) =>
                                setRowRequiresRecheck((prev) => ({
                                  ...prev,
                                  [entry.id]: e.target.checked,
                                }))
                              }
                              className="w-4 h-4 text-amber-500 border-slate-700 bg-slate-950 rounded focus:ring-amber-500/40"
                            />
                          </td>
                          {/* Acción: Guardar */}
                          <td className="px-4 py-3 text-right">
                            <button
                              type="button"
                              disabled={isSavingThis}
                              onClick={() => handleSaveRowSimple(entry, calcArrHHMMSS)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs rounded-xl shadow transition-all disabled:opacity-50"
                            >
                              {isSavingThis ? (
                                <span className="animate-spin text-xs">⏳</span>
                              ) : (
                                <>
                                  <svg
                                    className="w-4 h-4"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                    strokeWidth={2.5}
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      d="M5 13l4 4L19 7"
                                    />
                                  </svg>
                                  Guardar
                                </>
                              )}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* SECCIÓN INFERIOR: Registrados (Atendidos en Mesa) */}
          <div className="bg-slate-900/60 rounded-2xl border border-slate-800 overflow-hidden shadow-lg">
            <div className="bg-slate-900 border-b border-slate-800 px-5 py-3.5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="w-3 h-3 rounded-full bg-emerald-500" />
                <h2 className="text-base font-extrabold text-slate-200">
                  SECCIÓN INFERIOR: Registrados y Atendidos en Mesa ({registeredEntriesWithInspections.length})
                </h2>
              </div>
              <span className="text-xs text-slate-400 font-semibold">
                Ordenado por Hora de Guardado (Más recientes primero)
              </span>
            </div>

            {registeredEntriesWithInspections.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-sm font-semibold bg-slate-950/40">
                Aún no hay inspecciones guardadas en esta etapa.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-950 text-slate-400 text-[11px] font-black uppercase tracking-wider border-b border-slate-800">
                    <tr>
                      <th className="px-4 py-3">Dorsal</th>
                      <th className="px-4 py-3">Equino</th>
                      <th className="px-4 py-3">Jinete</th>
                      <th className="px-4 py-3 text-center">Pulso Registrado</th>
                      <th className="px-4 py-3 text-center">Rechequeo</th>
                      <th className="px-4 py-3 text-center">Hora Guardado</th>
                      <th className="px-4 py-3 text-right">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-medium">
                    {registeredEntriesWithInspections.map(({ entry, inspection }) => (
                      <tr key={inspection.id} className="hover:bg-slate-850/50 text-slate-200">
                        <td className="px-4 py-3 font-mono font-black text-emerald-400 text-base">
                          #{entry.bibNumber}
                        </td>
                        <td className="px-4 py-3 font-bold text-slate-100">
                          {entry.horse?.name || "Sin nombre"}
                        </td>
                        <td className="px-4 py-3 text-slate-300">
                          {entry.rider?.name || "Sin nombre"}
                        </td>
                        <td className="px-4 py-3 text-center font-mono font-bold text-emerald-300">
                          {inspection.heartRate} ppm
                        </td>
                        <td className="px-4 py-3 text-center">
                          {inspection.requiresRecheck ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-black bg-amber-950 text-amber-300 border border-amber-500/30">
                              SÍ (RECHEQUEO)
                            </span>
                          ) : (
                            <span className="text-slate-500 text-xs">No</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center font-mono text-slate-400 text-xs">
                          {formatHHMMSS(inspection.createdAt || inspection.vetInTime)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-extrabold bg-emerald-950 text-emerald-400 border border-emerald-500/30">
                            ✓ ATENDIDO
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* ── MODE 2: FORMULARIO DETALLADO (EXTENDIDO) ─────────────────────── */
        <form
          onSubmit={handleSubmit}
          className="grid grid-cols-1 md:grid-cols-2 gap-6"
        >
          {/* LEFT COLUMN: Metadata & Binomio Identification */}
          <div className="space-y-5 bg-slate-900/60 p-5 rounded-2xl border border-slate-800/80">
            <h2 className="text-base font-bold text-slate-300 border-b border-slate-800 pb-2">
              1. Selección de Etapa e Identificación
            </h2>

            {/* Dorsal input */}
            <div>
              <label className="block text-[11px] font-black text-slate-400 uppercase tracking-wider mb-2">
                Dorsal del Binomio
              </label>
              <div className="relative">
                <input
                  ref={bibInputRef}
                  type="text"
                  value={bibNumber}
                  onChange={(e) => setBibNumber(e.target.value)}
                  onKeyDown={(e) => handleKeyDown(e, vetInTimeRef)}
                  placeholder="Digitar Dorsal (ej. 101)"
                  autoFocus
                  className="w-full px-4 py-3.5 text-2xl font-black tracking-widest bg-slate-950 border border-slate-800 rounded-xl text-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 shadow-inner font-mono"
                />
                {loadingEntries && (
                  <div className="absolute right-4 top-1/2 -translate-y-1/2">
                    <div className="animate-spin w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full" />
                  </div>
                )}
              </div>
            </div>

            {/* Binomio Autocomplete Panel */}
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800/80 min-h-[120px] flex flex-col justify-center">
              {matchedEntry ? (
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                      Binomio Identificado
                    </span>
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-black uppercase border
                      ${
                        matchedEntry.status === ParticipantStatus.IN_RACE
                          ? "bg-emerald-950 text-emerald-400 border-emerald-500/25"
                          : matchedEntry.status === ParticipantStatus.VET_CHECK
                            ? "bg-amber-950 text-amber-400 border-amber-500/25"
                            : matchedEntry.status === ParticipantStatus.FINISHED ||
                              matchedEntry.status === ParticipantStatus.FINISHED_PROVISIONAL
                              ? "bg-blue-950 text-blue-400 border-blue-500/25"
                              : "bg-red-950 text-red-400 border-red-500/25"
                      }`}
                    >
                      {matchedEntry.status}
                    </span>
                  </div>
                  <div>
                    <div className="text-lg font-black text-slate-100">
                      {matchedEntry.rider.name}
                    </div>
                    <div className="text-xs font-bold text-slate-400 mt-0.5">
                      Caballo:{" "}
                      <span className="text-emerald-400">
                        {matchedEntry.horse.name}
                      </span>
                    </div>
                  </div>
                </div>
              ) : bibNumber.trim() ? (
                <div className="text-center py-4">
                  <div className="text-sm font-bold text-rose-500">
                    ⚠️ Dorsal #{bibNumber} no encontrado
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1">
                    Verifique que el número corresponda a la lista de inscritos.
                  </div>
                </div>
              ) : (
                <div className="text-center py-4 text-slate-500 text-xs font-semibold">
                  Esperando ingreso de dorsal para autocompletar...
                </div>
              )}
            </div>
          </div>

          {/* RIGHT COLUMN: Time stamps and parameters */}
          <div className="space-y-5 bg-slate-900/60 p-5 rounded-2xl border border-slate-800/80">
            <h2 className="text-base font-bold text-slate-300 border-b border-slate-800 pb-2">
              2. Puestos de Control y Parámetros
            </h2>

            {/* Puesto 1: Arrival Time */}
            <div>
              <label className="block text-[11px] font-black text-slate-400 uppercase tracking-wider mb-2">
                Puesto 1: Hora de Arribo (HH:MM:SS)
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={arrivalTime}
                  onChange={(e) => setArrivalTime(e.target.value)}
                  placeholder="HH:MM:SS"
                  maxLength={8}
                  disabled={isArrivalPreFilled}
                  className={`w-full px-4 py-2.5 text-xl font-bold bg-slate-950 border rounded-xl focus:outline-none shadow-inner font-mono
                    ${
                      isArrivalPreFilled
                        ? "border-emerald-500/30 text-emerald-400/90 cursor-not-allowed bg-emerald-950/10"
                        : "border-slate-800 text-slate-200 focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                    }`}
                />
                {isArrivalPreFilled && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[9px] font-black text-emerald-500/70 border border-emerald-500/20 bg-emerald-950 px-2 py-1 rounded-md uppercase tracking-wider">
                    Sincronizado
                  </span>
                )}
              </div>
            </div>

            {/* Puesto 2: Vet In Time */}
            <div>
              <label className="block text-[11px] font-black text-slate-400 uppercase tracking-wider mb-2 flex items-center justify-between">
                <span>Puesto 2: Hora de Ingreso Veterinario (HH:MM:SS)</span>
                <button
                  type="button"
                  onClick={() => setVetInTime(localNowHHMMSS())}
                  className="text-[10px] font-black text-emerald-400 bg-emerald-950 hover:bg-emerald-900 border border-emerald-500/20 px-2 py-0.5 rounded transition-all uppercase"
                >
                  Capturar Reloj
                </button>
              </label>
              <input
                ref={vetInTimeRef}
                type="text"
                value={vetInTime}
                onChange={(e) => setVetInTime(e.target.value)}
                onKeyDown={(e) => handleKeyDown(e, heartRateRef)}
                placeholder="HH:MM:SS"
                maxLength={8}
                className="w-full px-4 py-2.5 text-xl font-bold bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 shadow-inner font-mono"
              />
            </div>

            {/* Puesto 3: Heart Rate */}
            <div>
              <label className="block text-[11px] font-black text-slate-400 uppercase tracking-wider mb-2">
                Puesto 3: Frecuencia Cardíaca (PPM)
              </label>
              <input
                ref={heartRateRef}
                type="number"
                min={30}
                max={150}
                value={heartRate}
                onChange={(e) => setHeartRate(e.target.value)}
                onKeyDown={(e) => handleKeyDown(e, gaitStatusRef)}
                placeholder="Ej. 60"
                className="w-full px-4 py-2.5 text-xl font-bold bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 shadow-inner font-mono"
              />
            </div>

            {/* Gait Status */}
            <div>
              <label className="block text-[11px] font-black text-slate-400 uppercase tracking-wider mb-2">
                Estado de la Marcha (Trote)
              </label>
              <select
                ref={gaitStatusRef}
                value={gaitStatus}
                onChange={(e) => setGaitStatus(e.target.value as GaitStatus)}
                className="w-full px-4 py-2.5 text-sm bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 shadow-inner font-semibold"
              >
                <option value={GaitStatus.APPROVED}>
                  APPROVED — Trote Aprobado (APTO)
                </option>
                <option value={GaitStatus.LAMENESS_ELIMINATED}>
                  LAMENESS_ELIMINATED — Cojera (DESCALIFICADO)
                </option>
                <option value={GaitStatus.OBSERVATION}>
                  OBSERVATION — Bajo Observación
                </option>
              </select>
            </div>

            {/* Inspection Type */}
            <div>
              <label className="block text-[11px] font-black text-slate-400 uppercase tracking-wider mb-2">
                Tipo de Inspección
              </label>
              <select
                value={inspectionType}
                onChange={(e) =>
                  setInspectionType(e.target.value as InspectionType)
                }
                className="w-full px-4 py-2.5 text-sm bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 shadow-inner font-semibold"
              >
                <option value={InspectionType.STANDARD}>
                  STANDARD — Control Regular
                </option>
                <option value={InspectionType.RE_INSPECTION_MANDATORY}>
                  RE_INSPECTION_MANDATORY — Recheck Obligatorio
                </option>
                <option value={InspectionType.RE_INSPECTION_REQUESTED}>
                  RE_INSPECTION_REQUESTED — Recheck Solicitado (2do Intento)
                </option>
              </select>
            </div>

            {/* Checkbox: requiresRecheck */}
            <div className="flex items-center gap-3 p-3 bg-slate-950 rounded-xl border border-slate-800">
              <input
                id="requiresRecheck"
                type="checkbox"
                checked={requiresRecheck}
                onChange={(e) => setRequiresRecheck(e.target.checked)}
                className="w-5 h-5 text-emerald-500 border-slate-800 bg-slate-950 rounded focus:ring-emerald-500/30 focus:ring-2"
              />
              <label
                htmlFor="requiresRecheck"
                className="text-xs font-bold text-slate-300 select-none cursor-pointer"
              >
                Exigir Rechequeo Obligatorio antes de la Salida de Etapa
              </label>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-[11px] font-black text-slate-400 uppercase tracking-wider mb-2">
                Observaciones Clínicas / Notas
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Detalle clínico si corresponde..."
                rows={2}
                className="w-full px-4 py-2.5 text-sm bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 shadow-inner"
              />
            </div>
          </div>

          {/* FULL WIDTH ALERTS & SUBMIT BUTTON */}
          <div className="md:col-span-2 space-y-4">
            {isRecoveryWarning && (
              <div className="flex items-center gap-4 p-4 bg-red-950 border-2 border-red-500 rounded-2xl animate-pulse shadow-lg">
                <div className="w-10 h-10 bg-red-900 rounded-full flex items-center justify-center flex-shrink-0">
                  <svg
                    className="w-6 h-6 text-red-200"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2.5}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                    />
                  </svg>
                </div>
                <div>
                  <h3 className="text-sm font-black text-red-200 uppercase tracking-wider">
                    ⚠️ FUERA DE TIEMPO DE RECUPERACIÓN (ELIMINADO)
                  </h3>
                  <p className="text-xs text-red-300/90 mt-0.5 font-bold">
                    El tiempo transcurrido es de {Math.round(recoveryDiffMinutes)}{" "}
                    minutos. Excede el límite FEU de 20 minutos.
                  </p>
                </div>
              </div>
            )}

            {isPulseWarning && (
              <div className="flex items-center gap-4 p-4 bg-amber-950 border-2 border-amber-500 rounded-2xl animate-pulse shadow-lg">
                <div className="w-10 h-10 bg-amber-900 rounded-full flex items-center justify-center flex-shrink-0">
                  <svg
                    className="w-6 h-6 text-amber-200"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2.5}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                    />
                  </svg>
                </div>
                <div>
                  <h3 className="text-sm font-black text-amber-200 uppercase tracking-wider">
                    ⚠️ PULSO EXCEDIDO. EVALUAR RE-INSPECCIÓN O ELIMINACIÓN
                  </h3>
                  <p className="text-xs text-amber-300/90 mt-0.5 font-bold">
                    Las pulsaciones registradas son de {heartRate} ppm. Supera el
                    límite FEU de 65 ppm.
                  </p>
                </div>
              </div>
            )}

            {errorMsg && (
              <div className="flex items-start gap-3 p-4 bg-red-950/70 border border-red-500/30 rounded-xl">
                <svg
                  className="w-6 h-6 text-red-500 flex-shrink-0 mt-0.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <div>
                  <p className="text-xs font-black text-red-400">
                    Error en validación clínica
                  </p>
                  <p className="text-xs text-red-300/90 mt-0.5 font-semibold">
                    {errorMsg}
                  </p>
                </div>
              </div>
            )}

            {status === "success" && lastResult && (
              <div className="flex items-start gap-4 p-4 bg-emerald-950 border border-emerald-500/30 rounded-2xl shadow-lg">
                <div className="w-10 h-10 bg-emerald-900 rounded-full flex items-center justify-center flex-shrink-0">
                  <svg
                    className="w-5 h-5 text-emerald-200"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={3}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                </div>
                <div>
                  <h3 className="text-sm font-black text-emerald-200">
                    Inspección Veterinaria Guardada Exitosamente
                  </h3>
                  <p className="text-xs text-emerald-300/90 mt-1 font-semibold">
                    Dorsal: {lastResult.riderDorsal} · F. Cardíaca:{" "}
                    {lastResult.heartRate} ppm · Marcha: {lastResult.gaitStatus}
                  </p>
                </div>
              </div>
            )}

            <button
              ref={submitButtonRef}
              type="submit"
              disabled={status === "loading" || loadingComps || !matchedEntry}
              id="btn-consolidar-decision-vet"
              className="w-full flex items-center justify-center gap-3 px-6 py-5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-30 disabled:cursor-not-allowed text-white font-black text-lg rounded-2xl transition-all shadow-lg focus:outline-none focus:ring-4 focus:ring-emerald-500/30 uppercase"
            >
              {status === "loading" ? "Procesando transacciones FEU…" : "Consolidar Decisión Veterinaria"}
            </button>
          </div>
        </form>
      )}

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <div className="text-center pt-4 border-t border-slate-800">
        <p className="text-[11px] text-slate-500 font-bold">
          EquusCronos Control Desk · Operador:{" "}
          <span className="text-slate-400">
            {user?.name} ({user?.role})
          </span>
        </p>
        <p className="text-[10px] text-slate-600 mt-1">
          Estricto cumplimiento del Reglamento de Raid de la Federación Ecuestre Uruguaya.
        </p>
      </div>
    </div>
  );
}
