"use client";

import React from "react";
import { LeaderboardEntry } from "../hooks/useLiveLeaderboard";

export const FallbackJersey = ({
  representedTenant,
}: {
  representedTenant?: {
    name: string;
  } | null;
}) => {
  const initials = representedTenant?.name
    ? representedTenant.name
        .split(" ")
        .filter((w) => w.length > 1) // Evitar preposiciones cortas
        .map((w) => w[0])
        .join("")
        .substring(0, 3)
        .toUpperCase()
    : "L";

  return (
    <div
      className="relative flex items-center justify-center w-7 h-7 group cursor-help"
      title={representedTenant?.name || "Inscripción Libre / Sin Club"}
    >
      <svg
        className="w-7 h-7 text-slate-100 fill-slate-50 stroke-slate-400 stroke-1 hover:text-slate-200 transition-all drop-shadow-sm"
        viewBox="0 0 24 24"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M12 6.5 L16.5 3.5 L21.5 6 L19.5 10.5 H17.5 V21 H6.5 V10.5 H4.5 L2.5 6 L7.5 3.5 Z"
          strokeLinejoin="round"
        />
        <path d="M9 3.5 L12 6.5 L15 3.5" fill="none" />
      </svg>
      <span className="absolute text-[8px] font-black text-slate-700 pointer-events-none mt-1.5 tracking-tight uppercase">
        {initials}
      </span>
    </div>
  );
};

export const ClubJersey = ({
  representedTenant,
}: {
  representedTenant?: {
    id: string;
    name: string;
    location?: string;
    jerseyImageUrl?: string;
  } | null;
}) => {
  const shirtUrl =
    representedTenant?.jerseyImageUrl || (representedTenant as any)?.shirtUrl;

  const [hasError, setHasError] = React.useState(false);

  if (shirtUrl && !hasError) {
    return (
      <div
        className="relative flex items-center justify-center w-7 h-7 group"
        title={representedTenant?.name}
      >
        <img
          src={shirtUrl}
          alt={`Camiseta de ${representedTenant?.name || "Club"}`}
          className="w-7 h-7 object-contain drop-shadow-[0_1px_1px_rgba(0,0,0,0.15)]"
          onError={() => setHasError(true)}
        />
      </div>
    );
  }

  return <FallbackJersey representedTenant={representedTenant} />;
};

// Formateador robusto de horas oficiales (HH:MM:SS)
export const formatHHMMSS = (dateStr?: string) => {
  if (!dateStr) return "--";
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return "--";
    const hh = String(date.getHours()).padStart(2, "0");
    const mm = String(date.getMinutes()).padStart(2, "0");
    const ss = String(date.getSeconds()).padStart(2, "0");
    return `${hh}:${mm}:${ss}`;
  } catch {
    return "--";
  }
};

// Formateador robusto de tiempos de carrera en formato oficial (HH:mm:ss)
export const formatTime = (ms: number) => {
  if (ms === undefined || ms === null || isNaN(ms)) return "--";
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${hours.toString().padStart(2, "0")}:${minutes
    .toString()
    .padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
};

// Formateador de diferencias (Gap) con respecto al líder de la competencia
export const formatGap = (gapMs: number, totalRaceTimeMs: number) => {
  if (!totalRaceTimeMs || totalRaceTimeMs === 0) return "--";
  if (gapMs === 0)
    return (
      <span className="text-[#AD8F6C] font-black tracking-wide">LÍDER</span>
    );
  if (!gapMs || isNaN(gapMs)) return "--";
  const totalSeconds = Math.floor(gapMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `+${minutes}m ${seconds.toString().padStart(2, "0")}s`;
};

// Generador estético de badges de estado bajo el reglamento de la FEU
export const renderStatusBadge = (status: string) => {
  switch (status) {
    case "IN_RACE":
      return (
        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-950 border border-emerald-300 whitespace-nowrap animate-pulse">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 mr-1"></span>
          🏇 Carrera
        </span>
      );
    case "FINISHED_PROVISIONAL":
      return (
        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-950 border border-blue-300 whitespace-nowrap">
          <span className="h-1.5 w-1.5 rounded-full bg-blue-600 mr-1"></span>
          🏁 Prov.
        </span>
      );
    case "VET_CHECK":
      return (
        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-950 border border-amber-300 whitespace-nowrap animate-pulse">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-600 mr-1"></span>
          🩺 Vet
        </span>
      );
    case "RESTING":
      return (
        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-bold bg-sky-50 text-sky-950 border border-sky-300 whitespace-nowrap">
          <span className="h-1.5 w-1.5 rounded-full bg-sky-600 mr-1"></span>
          ⏱️ Neutr.
        </span>
      );
    case "FINISHED":
      return (
        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-bold bg-slate-900 text-white border border-slate-700 whitespace-nowrap">
          🏁 Fin
        </span>
      );
    case "DQ":
      return (
        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-950 border border-rose-300 whitespace-nowrap">
          🛑 DQ
        </span>
      );
    case "DNF":
      return (
        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-800 border border-slate-300 whitespace-nowrap">
          ⚠️ DNF
        </span>
      );
    case "WD":
      return (
        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-800 border border-slate-300 whitespace-nowrap">
          ⚠️ WD
        </span>
      );
    case "NO_COMPLETED":
      return (
        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-800 border border-slate-350 whitespace-nowrap">
          ❌ NC
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-bold bg-gray-100 text-gray-800 whitespace-nowrap">
          {status}
        </span>
      );
  }
};

interface StageHistoryProps {
  stages: NonNullable<LeaderboardEntry["stages"]>;
}

export function StageHistoryMobile({ stages }: StageHistoryProps) {
  if (!stages || stages.length === 0) {
    return (
      <div className="text-center py-2 text-slate-400 text-xs font-semibold">
        No hay etapas anteriores registradas.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {stages.map((stage) => (
        <div
          key={stage.stageNumber}
          className="bg-slate-50/60 border border-slate-100 rounded-2xl p-4 space-y-3"
        >
          <div className="flex items-center justify-between border-b border-slate-200/60 pb-2">
            <span className="font-extrabold text-slate-800 text-sm">
              Etapa {stage.stageNumber} ({stage.distanceKm} km)
            </span>
            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-100">
              🩺 Vet OK
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <span className="text-slate-400 block font-bold text-[9px] uppercase tracking-wider">
                Largada
              </span>
              <span className="font-sans tabular-nums font-bold text-slate-750">
                {formatHHMMSS(stage.startTime)}
              </span>
            </div>
            <div>
              <span className="text-slate-400 block font-bold text-[9px] uppercase tracking-wider">
                Llegada
              </span>
              <span className="font-sans tabular-nums font-bold text-slate-750">
                {formatHHMMSS(stage.arrivalTime)}
              </span>
            </div>
            <div>
              <span className="text-slate-400 block font-bold text-[9px] uppercase tracking-wider">
                Tiempo Neto
              </span>
              <span className="font-sans tabular-nums font-bold text-slate-900">
                {formatTime(stage.netTimeMs || 0)}
              </span>
            </div>
            <div>
              <span className="text-slate-400 block font-bold text-[9px] uppercase tracking-wider">
                Velocidad Prom.
              </span>
              <span className="font-bold text-slate-800">
                {stage.averageSpeed
                  ? `${stage.averageSpeed.toFixed(2)} km/h`
                  : "—"}
              </span>
            </div>
            <div>
              <span className="text-slate-400 block font-bold text-[9px] uppercase tracking-wider">
                Toma de Pulso
              </span>
              <span className="font-sans tabular-nums font-bold text-slate-750">
                {formatHHMMSS(stage.vetInTime)}
              </span>
            </div>
            <div>
              <span className="text-slate-400 block font-bold text-[9px] uppercase tracking-wider">
                Pulso
              </span>
              <span
                className={`font-sans tabular-nums font-bold px-1.5 py-0.5 rounded text-[11px] ${
                  stage.heartRate && stage.heartRate > 64
                    ? "bg-rose-100 text-rose-800"
                    : "bg-slate-100 text-slate-805"
                }`}
              >
                {stage.heartRate ? `${stage.heartRate} ppm` : "—"}
              </span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function StageHistoryTable({ stages }: StageHistoryProps) {
  if (!stages || stages.length === 0) {
    return (
      <div className="text-center py-4 text-slate-400 text-xs font-semibold">
        No hay etapas anteriores registradas.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left border-collapse table-fixed min-w-[700px]">
        <colgroup>
          <col className="w-24" /> {/* Etapa */}
          <col className="w-24" /> {/* Distancia */}
          <col className="w-28" /> {/* Largada */}
          <col className="w-28" /> {/* Llegada */}
          <col className="w-28" /> {/* Tiempo Neto */}
          <col className="w-28" /> {/* Vel. Prom. */}
          <col className="w-32" /> {/* Toma de Pulso */}
          <col className="w-24" /> {/* Pulso */}
          <col className="w-28" /> {/* Estado */}
        </colgroup>
        <thead>
          <tr className="border-b border-slate-200 text-slate-400 text-[10px] font-bold uppercase tracking-wider">
            <th className="py-2.5 px-3">Etapa</th>
            <th className="py-2.5 px-3 text-center">Distancia</th>
            <th className="py-2.5 px-3">Largada</th>
            <th className="py-2.5 px-3">Llegada</th>
            <th className="py-2.5 px-3">Tiempo Neto</th>
            <th className="py-2.5 px-3">Vel. Prom.</th>
            <th className="py-2.5 px-3">Toma de Pulso</th>
            <th className="py-2.5 px-3 text-center">Pulso</th>
            <th className="py-2.5 px-3 text-center">Estado</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200/50 text-xs text-slate-600 font-medium">
          {stages.map((stage) => (
            <tr
              key={stage.stageNumber}
              className="hover:bg-slate-100/30 transition-colors"
            >
              <td className="py-3 px-3 font-extrabold text-slate-850">
                Etapa {stage.stageNumber}
              </td>
              <td className="py-3 px-3 text-center font-semibold text-slate-800">
                {stage.distanceKm} km
              </td>
              <td className="py-3 px-3 font-sans tabular-nums text-slate-500">
                {formatHHMMSS(stage.startTime)}
              </td>
              <td className="py-3 px-3 font-sans tabular-nums text-slate-500">
                {formatHHMMSS(stage.arrivalTime)}
              </td>
              <td className="py-3 px-3 font-sans tabular-nums font-medium text-slate-700">
                {formatTime(stage.netTimeMs || 0)}
              </td>
              <td className="py-3 px-3 text-slate-650">
                {stage.averageSpeed
                  ? `${stage.averageSpeed.toFixed(2)} km/h`
                  : "—"}
              </td>
              <td className="py-3 px-3 font-sans tabular-nums text-slate-500">
                {formatHHMMSS(stage.vetInTime)}
              </td>
              <td className="py-3 px-3 text-center">
                {stage.heartRate ? (
                  <span
                    className={`inline-block font-sans tabular-nums font-extrabold text-[11px] px-2 py-0.5 rounded ${
                      stage.heartRate > 64
                        ? "bg-rose-50 text-rose-750 border border-rose-100"
                        : "bg-slate-50 text-slate-600 border border-slate-100"
                    }`}
                  >
                    {stage.heartRate} ppm
                  </span>
                ) : (
                  <span className="text-slate-350">—</span>
                )}
              </td>
              <td className="py-3 px-3 text-center">
                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-100">
                  🩺 Vet OK
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
