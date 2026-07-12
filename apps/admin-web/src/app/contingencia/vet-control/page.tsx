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

interface CompetitionEntry {
  id: string;
  bibNumber: number;
  status: string;
  rider: { name: string };
  horse: { name: string };
  timingRecords?: TimingRecord[];
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
    // Cross midnight
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

  // State: Form Inputs
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

  // Find active entry matching the typed bib number
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
        const firstStage = (data[0] as Competition).stages?.[0];
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

  // Load entries when competition changes
  useEffect(() => {
    if (!competitionId) {
      setEntries([]);
      return;
    }

    setLoadingEntries(true);
    CompetitionEntryService.getAllByCompetition(competitionId)
      .then((data) => {
        setEntries(data as CompetitionEntry[]);
      })
      .catch((e) => {
        console.error("Error cargando binomios:", e);
      })
      .finally(() => {
        setLoadingEntries(false);
      });
  }, [competitionId]);

  // Reset stage and clear form when competition changes
  useEffect(() => {
    const comp = competitions.find((c) => c.id === competitionId);
    const first = comp?.stages?.[0];
    setStageId(first?.id ?? "");
    clearForm(false); // keep bib number if they are in middle of typing, but clean otherwise
  }, [competitionId, competitions]);

  // Autocomplete Puesto 1 (Arribo) when matchedEntry or stageId changes
  useEffect(() => {
    if (!matchedEntry || !selectedStage) {
      setArrivalTime("");
      setIsArrivalPreFilled(false);
      return;
    }

    // Find if there is an Arrival record for this stage
    const arrivalRecord = matchedEntry.timingRecords?.find(
      (r) =>
        r.recordType === "ARRIVAL" &&
        !r.isVoid &&
        r.stage?.stageNumber === selectedStage.stageNumber,
    );

    if (arrivalRecord) {
      const date = new Date(arrivalRecord.recordedAt);
      const hhmmss = [
        String(date.getHours()).padStart(2, "0"),
        String(date.getMinutes()).padStart(2, "0"),
        String(date.getSeconds()).padStart(2, "0"),
      ].join(":");
      setArrivalTime(hhmmss);
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

    // Return focus to bib number
    if (resetBib && bibInputRef.current) {
      bibInputRef.current.focus();
    }
  };

  // Submit Handler
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

      // Reload entries list to get updated statuses/times in memory
      const updatedEntries =
        await CompetitionEntryService.getAllByCompetition(competitionId);
      setEntries(updatedEntries as CompetitionEntry[]);

      // Reset form after short delay or instantly
      clearForm(true);
    } catch (err: any) {
      setErrorMsg(
        err.message || "Error al procesar la inspección veterinaria.",
      );
      setStatus("error");
    }
  };

  // Keyboard sequential movement helper
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
    <div className="space-y-6 max-w-4xl mx-auto p-4 md:p-6 bg-slate-950 text-white rounded-3xl shadow-2xl border border-slate-800">
      {/* ── Header Area ──────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 border-b border-slate-800 pb-5">
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
            <h1 className="text-3xl font-extrabold text-slate-100 tracking-tight leading-tight">
              Mesa de Control Veterinario
            </h1>
            <p className="mt-1.5 text-sm text-slate-400">
              Consola de alta visibilidad para validación clínica en tiempo real
              y consolidación de eliminaciones FEU.
            </p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className="inline-flex items-center px-3 py-1.5 rounded-xl text-xs font-black bg-emerald-950 text-emerald-400 border border-emerald-500/20 tracking-wider">
            {user?.role} ONLINE
          </span>
          <span className="text-[10px] text-slate-500 font-mono">
            {localNowHHMMSS()} Uruguayo
          </span>
        </div>
      </div>

      {/* ── Form Container ───────────────────────────────────────────────── */}
      <form
        onSubmit={handleSubmit}
        className="grid grid-cols-1 md:grid-cols-2 gap-6"
      >
        {/* LEFT COLUMN: Metadata & Binomio Identification */}
        <div className="space-y-5 bg-slate-900/60 p-5 rounded-2xl border border-slate-800/80">
          <h2 className="text-base font-bold text-slate-300 border-b border-slate-800 pb-2">
            1. Selección de Etapa e Identificación
          </h2>

          {/* Competition selector */}
          <div>
            <label className="block text-[11px] font-black text-slate-400 uppercase tracking-wider mb-2">
              Competencia Activa
            </label>
            {loadingComps ? (
              <div className="h-11 bg-slate-850 rounded-xl animate-pulse" />
            ) : (
              <select
                value={competitionId}
                onChange={(e) => setCompetitionId(e.target.value)}
                className="w-full px-4 py-3 text-sm bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 shadow-inner font-semibold"
              >
                {competitions.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} —{" "}
                    {c.status === "ACTIVE" ? "🟢 EN CARRERA" : "📋 Planificada"}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Stage selector */}
          <div>
            <label className="block text-[11px] font-black text-slate-400 uppercase tracking-wider mb-2">
              Etapa / Vet Gate
            </label>
            {stages.length === 0 ? (
              <p className="text-sm text-slate-500 italic py-2">
                No hay etapas configuradas para la competencia seleccionada.
              </p>
            ) : (
              <select
                value={stageId}
                onChange={(e) => setStageId(e.target.value)}
                className="w-full px-4 py-3 text-sm bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 shadow-inner font-semibold"
              >
                {stages.map((s) => (
                  <option key={s.id} value={s.id}>
                    Etapa {s.stageNumber} — Vet Gate ({s.distanceKm} km)
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Dorsal input (Dorsal-Centric) */}
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
            {!isArrivalPreFilled && (
              <p className="mt-1 text-[10px] text-amber-500 font-semibold">
                * Llegada manual (se creará registro de arribo en contingencia).
              </p>
            )}
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
          {/* Recovery Time Warning Alert */}
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

          {/* Pulse Warning Alert */}
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

          {/* Error Message banner */}
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

          {/* Success message banner */}
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
                <p className="text-[10px] text-emerald-400 mt-1 font-mono">
                  Transacción de persistencia consolidada. Clasificador y
                  Leaderboard actualizados vía WebSockets.
                </p>
              </div>
            </div>
          )}

          {/* Submit button */}
          <button
            ref={submitButtonRef}
            type="submit"
            disabled={status === "loading" || loadingComps || !matchedEntry}
            id="btn-consolidar-decision-vet"
            className="w-full flex items-center justify-center gap-3 px-6 py-5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-emerald-600 text-white font-black text-lg rounded-2xl transition-all duration-200 shadow-lg hover:shadow-emerald-500/20 hover:shadow-xl focus:outline-none focus:ring-4 focus:ring-emerald-500/30 tracking-wider uppercase"
          >
            {status === "loading" ? (
              <>
                <svg
                  className="animate-spin w-6 h-6 text-white"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
                Procesando transacciones FEU…
              </>
            ) : (
              <>
                <svg
                  className="w-6 h-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                Consolidar Decisión Veterinaria
              </>
            )}
          </button>
        </div>
      </form>

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <div className="text-center pt-4 border-t border-slate-800">
        <p className="text-[11px] text-slate-500 font-bold">
          EquusCronos Control Desk · Operador:{" "}
          <span className="text-slate-400">
            {user?.name} ({user?.role})
          </span>
        </p>
        <p className="text-[10px] text-slate-600 mt-1">
          Estricto cumplimiento del Reglamento de Raid de la Federación Ecuestre
          Uruguaya.
        </p>
      </div>
    </div>
  );
}
