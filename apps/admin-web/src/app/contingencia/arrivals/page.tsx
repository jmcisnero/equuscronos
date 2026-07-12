"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useAuthStore } from "@/store/auth.store";
import { TimingService } from "@/services/api/timing.service";

// ─── Types ──────────────────────────────────────────────────────────────────
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

type SubmitStatus = "idle" | "loading" | "success" | "error";

interface LastResult {
  id: string;
  recordType: string;
  recordedAt: string;
  isApproved: boolean;
  eliminated?: boolean;
  eliminationReason?: string | null;
}

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

function checkpointLabel(stage: Stage, type: "ARRIVAL" | "VET_IN"): string {
  const suffix =
    type === "ARRIVAL" ? "Llegada Meta" : "Presentación Veterinaria";
  return `Etapa ${stage.stageNumber} · ${suffix} (${stage.distanceKm} km)`;
}

// ─── Component ──────────────────────────────────────────────────────────────
export default function ArribosContingenciaPage() {
  const user = useAuthStore((s) => s.user);

  // Form state
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [competitionId, setCompetitionId] = useState("");
  const [stageId, setStageId] = useState("");
  const [recordType, setRecordType] = useState<"ARRIVAL" | "VET_IN">("ARRIVAL");
  const [bibNumber, setBibNumber] = useState("");
  const [arrivalTime, setArrivalTime] = useState(localNowHHMMSS());

  // UI state
  const [loadingComps, setLoadingComps] = useState(true);
  const [status, setStatus] = useState<SubmitStatus>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<LastResult | null>(null);

  const selectedComp = competitions.find((c) => c.id === competitionId);
  const stages: Stage[] = selectedComp?.stages ?? [];

  // ── Access guard ────────────────────────────────────────────────────────
  const hasAccess = user ? ALLOWED_ROLES.includes(user.role) : false;

  // ── Load competitions ────────────────────────────────────────────────────
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

  // Reset stage when competition changes
  useEffect(() => {
    const comp = competitions.find((c) => c.id === competitionId);
    const first = comp?.stages?.[0];
    setStageId(first?.id ?? "");
  }, [competitionId, competitions]);

  // ── Submit ───────────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setLastResult(null);

    const bib = parseInt(bibNumber.trim(), 10);
    if (!competitionId) {
      setErrorMsg("Debe seleccionar una competencia.");
      return;
    }
    if (!stageId) {
      setErrorMsg("Debe seleccionar un checkpoint / etapa.");
      return;
    }
    if (isNaN(bib) || bib <= 0) {
      setErrorMsg("El número de dorsal debe ser un entero positivo.");
      return;
    }
    if (!/^\d{2}:\d{2}:\d{2}$/.test(arrivalTime)) {
      setErrorMsg("El formato de hora debe ser HH:MM:SS.");
      return;
    }

    setStatus("loading");
    try {
      const recordedAt = buildIsoFromTimeInput(arrivalTime);
      const result = await TimingService.createRecord({
        competitionId,
        stageId,
        bibNumber: bib,
        recordType,
        recordedAt,
        isAutomatic: false,
      });
      setLastResult(result as LastResult);
      setStatus("success");
      setBibNumber("");
      setArrivalTime(localNowHHMMSS());
    } catch (err: any) {
      setErrorMsg(err.message || "Error desconocido al registrar el tiempo.");
      setStatus("error");
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────
  if (!hasAccess) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-8 text-center max-w-md">
          <div className="w-14 h-14 bg-rose-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-7 h-7 text-rose-600"
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
          <h2 className="text-lg font-bold text-rose-800 mb-2">
            Acceso Denegado
          </h2>
          <p className="text-sm text-rose-600">
            Esta pantalla requiere rol de{" "}
            <strong>ADMIN, CLUB_ADMIN, JUDGE</strong> o{" "}
            <strong>TIMEKEEPER</strong>.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-start gap-4">
        <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-amber-100 border border-amber-200 flex items-center justify-center shadow-sm">
          <svg
            className="w-6 h-6 text-amber-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>
        <div>
          <h1 className="text-2xl font-extrabold text-slate-800 tracking-tight leading-tight">
            Puesto de Arribos · Contingencia
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Registro manual de tiempos de llegada en caso de falla de hardware
            en campo. Simula exactamente el comportamiento de la Field App.
          </p>
        </div>
      </div>

      {/* ── Alert banner ────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 p-3.5 bg-amber-50 border border-amber-200/80 rounded-xl">
        <svg
          className="w-5 h-5 text-amber-600 flex-shrink-0"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <p className="text-xs font-semibold text-amber-800">
          MODO CONTINGENCIA · Los registros actualizan el clasificador en vivo
          en tiempo real (WebSocket). Verificar horario exacto antes de
          confirmar.
        </p>
      </div>

      {/* ── Form card ───────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100/80 overflow-hidden">
        <div className="bg-slate-50 border-b border-slate-100 px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-slate-700">
              Ingreso de Tiempo Manual
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Todos los campos son obligatorios
            </p>
          </div>
          <span
            className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border
            ${
              user?.role === "ADMIN"
                ? "bg-purple-50 text-purple-700 border-purple-200"
                : user?.role === "JUDGE"
                  ? "bg-blue-50 text-blue-700 border-blue-200"
                  : user?.role === "TIMEKEEPER"
                    ? "bg-teal-50 text-teal-700 border-teal-200"
                    : "bg-emerald-50 text-emerald-700 border-emerald-200"
            }`}
          >
            {user?.role}
          </span>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Competition selector */}
          <div>
            <label
              htmlFor="competitionId"
              className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5"
            >
              Competencia Activa
            </label>
            {loadingComps ? (
              <div className="h-11 bg-slate-100 rounded-xl animate-pulse" />
            ) : competitions.length === 0 ? (
              <p className="text-sm text-slate-400 italic py-2">
                No hay competencias activas o planificadas para su organización.
              </p>
            ) : (
              <select
                id="competitionId"
                value={competitionId}
                onChange={(e) => setCompetitionId(e.target.value)}
                className="w-full px-4 py-2.5 text-sm bg-white border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-equus-green/20 focus:border-equus-green shadow-sm"
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

          {/* Checkpoint / Stage */}
          <div>
            <label
              htmlFor="stageId"
              className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5"
            >
              Checkpoint / Etapa
            </label>
            {stages.length === 0 ? (
              <p className="text-sm text-slate-400 italic py-2">
                Seleccione una competencia con etapas configuradas.
              </p>
            ) : (
              <div className="space-y-2">
                {/* Record type toggle */}
                <div className="flex gap-2 mb-3">
                  {(["ARRIVAL", "VET_IN"] as const).map((rt) => (
                    <button
                      key={rt}
                      type="button"
                      onClick={() => setRecordType(rt)}
                      className={`flex-1 py-2 text-xs font-bold rounded-lg border transition-all duration-150 ${
                        recordType === rt
                          ? "bg-equus-green text-white border-equus-green shadow-sm"
                          : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                      }`}
                    >
                      {rt === "ARRIVAL"
                        ? "🏁 Llegada Meta"
                        : "🩺 Presentación Vet."}
                    </button>
                  ))}
                </div>

                <select
                  id="stageId"
                  value={stageId}
                  onChange={(e) => setStageId(e.target.value)}
                  className="w-full px-4 py-2.5 text-sm bg-white border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-equus-green/20 focus:border-equus-green shadow-sm"
                >
                  {stages.map((s) => (
                    <option key={s.id} value={s.id}>
                      {checkpointLabel(s, recordType)}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Dorsal number */}
          <div>
            <label
              htmlFor="bibNumber"
              className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5"
            >
              Dorsal Nro.
            </label>
            <input
              id="bibNumber"
              type="number"
              min={1}
              max={9999}
              value={bibNumber}
              onChange={(e) => setBibNumber(e.target.value)}
              placeholder="Ej: 102"
              className="w-full px-4 py-2.5 text-lg font-extrabold tracking-widest bg-white border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-equus-green/20 focus:border-equus-green shadow-sm tabular-nums placeholder:font-normal placeholder:text-slate-300 placeholder:text-sm placeholder:tracking-normal"
            />
          </div>

          {/* Time input */}
          <div>
            <label
              htmlFor="arrivalTime"
              className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5"
            >
              Hora Exacta de Arribo (HH:MM:SS)
            </label>
            <div className="relative">
              <input
                id="arrivalTime"
                type="text"
                value={arrivalTime}
                onChange={(e) => setArrivalTime(e.target.value)}
                placeholder="HH:MM:SS"
                maxLength={8}
                pattern="\d{2}:\d{2}:\d{2}"
                className="w-full pl-12 pr-4 py-3 text-2xl font-extrabold tracking-[0.25em] tabular-nums bg-white border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-equus-green/20 focus:border-equus-green shadow-sm font-mono placeholder:text-slate-300 placeholder:text-base placeholder:tracking-normal"
              />
              <button
                type="button"
                title="Capturar hora actual"
                onClick={() => setArrivalTime(localNowHHMMSS())}
                className="absolute left-3 top-1/2 -translate-y-1/2 p-1.5 rounded-lg bg-slate-100 hover:bg-equus-green/10 text-slate-500 hover:text-equus-green transition-colors"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </button>
            </div>
            <p className="mt-1.5 text-[11px] text-slate-400">
              Pulse el ícono del reloj para capturar la hora actual del sistema.
              Edite manualmente si es necesario.
            </p>
          </div>

          {/* Error banner */}
          {errorMsg && (
            <div className="flex items-start gap-3 p-3.5 bg-rose-50 border border-rose-200 rounded-xl">
              <svg
                className="w-5 h-5 text-rose-500 flex-shrink-0 mt-0.5"
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
                <p className="text-xs font-bold text-rose-700">
                  Error transaccional
                </p>
                <p className="text-xs text-rose-600 mt-0.5">{errorMsg}</p>
              </div>
            </div>
          )}

          {/* Success banner */}
          {status === "success" && lastResult && (
            <div className="flex items-start gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${lastResult.eliminated ? "bg-rose-100" : "bg-emerald-100"}`}
              >
                {lastResult.eliminated ? (
                  <svg
                    className="w-4 h-4 text-rose-600"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2.5}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                ) : (
                  <svg
                    className="w-4 h-4 text-emerald-600"
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
                )}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-emerald-800">
                  {lastResult.eliminated
                    ? "⚠️ Registro guardado — Competidor DESCALIFICADO"
                    : "✅ Tiempo registrado exitosamente"}
                </p>
                <p className="text-[11px] text-emerald-600 mt-0.5 font-mono">
                  ID: {lastResult.id.substring(0, 8)}… ·{" "}
                  {new Date(lastResult.recordedAt).toLocaleTimeString("es-UY")}
                </p>
                {lastResult.eliminationReason && (
                  <p className="text-[11px] text-rose-600 mt-1 font-semibold">
                    {lastResult.eliminationReason}
                  </p>
                )}
                <p className="text-[11px] text-emerald-500 mt-1">
                  Clasificador actualizado en tiempo real ✓
                </p>
              </div>
            </div>
          )}

          {/* Submit button */}
          <button
            type="submit"
            disabled={
              status === "loading" || loadingComps || competitions.length === 0
            }
            id="btn-registrar-tiempo-contingencia"
            className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-equus-green hover:bg-opacity-90 disabled:opacity-50 disabled:cursor-not-allowed text-white font-extrabold text-base rounded-xl transition-all duration-200 shadow-md hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-equus-green"
          >
            {status === "loading" ? (
              <>
                <svg
                  className="animate-spin w-5 h-5 text-white"
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
                Registrando tiempo…
              </>
            ) : (
              <>
                <svg
                  className="w-5 h-5"
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
                Confirmar Arribo
              </>
            )}
          </button>
        </form>
      </div>

      {/* ── Footer info ─────────────────────────────────────────────────── */}
      <div className="text-center">
        <p className="text-[11px] text-slate-400">
          Operador: <strong className="text-slate-500">{user?.name}</strong> ·
          Rol: <strong className="text-slate-500">{user?.role}</strong>
          {user?.tenantId && (
            <>
              {" "}
              · Tenant:{" "}
              <strong className="text-slate-500">
                {user.tenantId.substring(0, 8)}…
              </strong>
            </>
          )}
        </p>
        <p className="text-[10px] text-slate-300 mt-0.5">
          Aislamiento multi-tenant activo · RLS validado en servidor
        </p>
      </div>
    </div>
  );
}
