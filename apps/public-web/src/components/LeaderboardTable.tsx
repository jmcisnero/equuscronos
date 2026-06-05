"use client";

import React from "react";
import { useLiveLeaderboard, LeaderboardEntry } from "../hooks/useLiveLeaderboard";

interface LeaderboardTableProps {
  competitionId: string;
  searchQuery?: string;
  isDemoMode?: boolean;
  simulatedData?: LeaderboardEntry[];
  onErrorChange?: (hasError: boolean) => void;
  onValidatingChange?: (isValidating: boolean) => void;
}

export default function LeaderboardTable({
  competitionId,
  searchQuery = "",
  isDemoMode = false,
  simulatedData = [],
  onErrorChange,
  onValidatingChange,
}: LeaderboardTableProps) {
  // Consumir el hook useLiveLeaderboard con polling en tiempo real cada 30 segundos
  const { leaderboard, error, isLoading, isValidating } = useLiveLeaderboard(competitionId);

  // Informar al layout root sobre errores en la llamada a la API
  React.useEffect(() => {
    if (onErrorChange) {
      onErrorChange(!!error);
    }
  }, [error, onErrorChange]);

  // Notificar al componente padre sobre la validación en segundo plano de SWR
  React.useEffect(() => {
    if (onValidatingChange) {
      onValidatingChange(isValidating);
    }
  }, [isValidating, onValidatingChange]);

  // Decisión del set de datos: Modo Demo (simulado) vs Datos reales del SWR
  const activeData = isDemoMode ? simulatedData : leaderboard;

  // Filtrado reactivo multivariable (nombre jinete, caballo o número de dorsal)
  const filteredData = React.useMemo(() => {
    return activeData.filter((entry) => {
      const query = searchQuery.toLowerCase().trim();
      if (!query) return true;
      return (
        entry.riderName.toLowerCase().includes(query) ||
        entry.horseName.toLowerCase().includes(query) ||
        entry.bibNumber.toString().includes(query)
      );
    });
  }, [activeData, searchQuery]);

  // Formateador robusto de horas oficiales (HH:MM:SS)
  const formatHHMMSS = (dateStr?: string) => {
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
  const formatTime = (ms: number) => {
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
  const formatGap = (gapMs: number, totalRaceTimeMs: number) => {
    if (!totalRaceTimeMs || totalRaceTimeMs === 0) return "--";
    if (gapMs === 0) return <span className="text-[#AD8F6C] font-black tracking-wide">LÍDER</span>;
    if (!gapMs || isNaN(gapMs)) return "--";
    const totalSeconds = Math.floor(gapMs / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `+${minutes}m ${seconds.toString().padStart(2, "0")}s`;
  };

  // Generador estético de badges de estado bajo el reglamento de la FEU
  const renderStatusBadge = (status: string) => {
    switch (status) {
      case "IN_RACE":
        return (
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-950 border border-emerald-300 whitespace-nowrap animate-pulse">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 mr-1"></span>
            🏇 Carrera
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
      default:
        return (
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-bold bg-gray-100 text-gray-800 whitespace-nowrap">
            {status}
          </span>
        );
    }
  };

  // AUDITORÍA RESPONSIVA Y CLS:
  // Renderizamos cargadores Skeletons con diseño espejo (Dual Layout Skeleton)
  // para evitar saltos bruscos de Cumulative Layout Shift (CLS) en celulares.
  if (isLoading && !isDemoMode) {
    return (
      <div className="space-y-6">
        
        {/* Skeleton de Escritorio (Desktop Table Skeleton) */}
        <div className="hidden md:block bg-white border border-slate-200/60 rounded-3xl shadow-sm overflow-hidden">
          <div className="bg-slate-50 border-b border-slate-100 h-14 w-full animate-pulse"></div>
          <div className="divide-y divide-slate-100">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-18 px-6 flex items-center justify-between space-x-6 animate-pulse">
                <div className="h-8 w-8 bg-slate-200 rounded-full"></div>
                <div className="h-6 w-12 bg-slate-200 rounded"></div>
                <div className="flex-1 space-y-2">
                  <div className="h-5 bg-slate-200 rounded w-1/3"></div>
                  <div className="h-4 bg-slate-100 rounded w-1/4"></div>
                </div>
                <div className="h-5 w-10 bg-slate-200 rounded"></div>
                <div className="h-5 w-24 bg-slate-200 rounded"></div>
                <div className="h-5 w-16 bg-slate-200 rounded"></div>
                <div className="h-5 w-20 bg-slate-200 rounded"></div>
                <div className="h-5 w-12 bg-slate-200 rounded"></div>
                <div className="h-8 w-24 bg-slate-200 rounded-full"></div>
              </div>
            ))}
          </div>
        </div>

        {/* Skeleton de Móvil (Mobile Cards Skeleton) */}
        <div className="block md:hidden space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white border border-slate-200/60 rounded-3xl p-5 space-y-4 animate-pulse">
              <div className="flex justify-between items-center">
                <div className="flex items-center space-x-3">
                  <div className="h-8 w-8 bg-slate-200 rounded-full"></div>
                  <div className="h-6 w-12 bg-slate-200 rounded"></div>
                </div>
                <div className="h-8 w-24 bg-slate-200 rounded-full"></div>
              </div>
              <div className="space-y-2">
                <div className="h-5 bg-slate-200 rounded w-2/3"></div>
                <div className="h-4 bg-slate-100 rounded w-1/2"></div>
              </div>
              <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-100">
                <div className="h-4 bg-slate-200 rounded w-3/4"></div>
                <div className="h-4 bg-slate-200 rounded w-2/3"></div>
                <div className="h-4 bg-slate-200 rounded w-1/2"></div>
                <div className="h-4 bg-slate-200 rounded w-3/4"></div>
              </div>
            </div>
          ))}
        </div>

      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* ========================================================================= */}
      {/* VISTA MÓVIL (MOBILE CARD VIEW)                                            */}
      {/* Evita desbordamiento y scroll horizontal incómodo en celulares de baja gama*/}
      {/* ========================================================================= */}
      <div className="block md:hidden space-y-4">
        {filteredData.length > 0 ? (
          filteredData.map((entry) => {
            const rankBg =
              entry.rank === 1
                ? "bg-amber-100 text-amber-950 border-amber-300"
                : entry.rank === 2
                ? "bg-slate-100 text-slate-900 border-slate-300"
                : entry.rank === 3
                ? "bg-orange-100 text-orange-950 border-orange-300"
                : "bg-slate-50 text-slate-700 border-slate-200";

            return (
              <div
                key={entry.bibNumber}
                className={`bg-white border border-slate-200/60 rounded-3xl p-5 shadow-sm space-y-4 transition-all ${
                  entry.status === "DQ" ? "opacity-65 bg-slate-50/50" : ""
                }`}
              >
                {/* Cabecera de la Tarjeta del Binomio */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full border text-xs font-black ${rankBg}`}>
                      {entry.rank}
                    </span>
                    <span className="bg-slate-950 text-white font-mono text-xs font-extrabold px-2 py-1 rounded-lg">
                      #{entry.bibNumber}
                    </span>
                  </div>
                  {renderStatusBadge(entry.status)}
                </div>

                {/* Información del Binomio con Alto Contraste para Lectura al Aire Libre */}
                <div className="space-y-1">
                  <h4 className="font-extrabold text-slate-900 text-base leading-tight">
                    {entry.riderName}
                  </h4>
                  <p className="text-xs text-slate-500 font-bold flex items-center">
                    <svg className="h-3.5 w-3.5 mr-1 text-[#AD8F6C]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                    Caballo: {entry.horseName}
                  </p>
                </div>

                {/* Grid de Estadísticas Técnicas del Binomio */}
                <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-100 text-xs">
                  <div>
                    <span className="text-slate-400 block font-bold text-[9px] uppercase tracking-wider">Etapa</span>
                    <span className="font-extrabold text-slate-800">Etapa {entry.currentStage}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-bold text-[9px] uppercase tracking-wider">Tiempo Neto</span>
                    <span className="font-mono font-bold text-slate-900">{formatTime(entry.totalRaceTimeMs)}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-bold text-[9px] uppercase tracking-wider">Diferencia</span>
                    <span className="font-mono font-bold text-slate-900">{formatGap(entry.gapToLeaderMs, entry.totalRaceTimeMs)}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-bold text-[9px] uppercase tracking-wider">Velocidad Promedio</span>
                    <span className="font-extrabold text-slate-800">
                      {entry.averageSpeed ? `${entry.averageSpeed.toFixed(2)} km/h` : "--"}
                    </span>
                  </div>
                  
                  {entry.startTime && (
                    <div>
                      <span className="text-slate-400 block font-bold text-[9px] uppercase tracking-wider">Hora Salida</span>
                      <span className="font-mono font-bold text-blue-600">{formatHHMMSS(entry.startTime)}</span>
                    </div>
                  )}
                  {entry.arrivalTime && (
                    <div>
                      <span className="text-slate-400 block font-bold text-[9px] uppercase tracking-wider">Hora Llegada</span>
                      <span className="font-mono font-bold text-emerald-600">{formatHHMMSS(entry.arrivalTime)}</span>
                    </div>
                  )}
                  {entry.vetInTime && (
                    <div>
                      <span className="text-slate-400 block font-bold text-[9px] uppercase tracking-wider">Toma de Pulso</span>
                      <span className="font-mono font-bold text-slate-800">{formatHHMMSS(entry.vetInTime)}</span>
                    </div>
                  )}
                  {entry.nextVetControlTime && (
                    <div>
                      <span className="text-slate-400 block font-bold text-[9px] uppercase tracking-wider">Límite Vet Gate</span>
                      <span className="font-mono font-bold text-amber-600">{formatHHMMSS(entry.nextVetControlTime)}</span>
                    </div>
                  )}
                  
                  {/* Frecuencia cardíaca (Pulso) conforme límites FEU */}
                  {entry.heartRate && (
                    <div className="col-span-2 pt-2 border-t border-dashed border-slate-100 flex justify-between items-center">
                      <span className="text-slate-400 font-bold text-[9px] uppercase tracking-wider">Pulsaciones (Límite 60/64 FEU)</span>
                      <span className={`font-mono font-black px-2.5 py-1 rounded-lg text-xs ${
                        entry.heartRate > 64
                          ? "bg-rose-100 text-rose-900 border border-rose-200"
                          : "bg-slate-100 text-slate-900 border border-slate-200"
                      }`}>
                        {entry.heartRate} ppm
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        ) : (
          <div className="bg-white border border-slate-200/60 rounded-3xl p-8 text-center text-slate-500 text-sm font-medium">
            No se encontraron binomios que coincidan con la búsqueda.
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* VISTA ESCRITORIO (DESKTOP TABLE VIEW)                                     */}
      {/* Renderizado de tabla estructurada en pantallas grandes (md y superiores)  */}
      {/* ========================================================================= */}
      <div className="hidden md:block bg-white border border-slate-200/60 rounded-3xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 text-xs font-bold uppercase tracking-wider">
                <th className="py-4.5 px-2 text-center w-12">Pos.</th>
                <th className="py-4.5 px-3 text-center w-16">Dorsal</th>
                <th className="py-4.5 px-3">Binomio</th>
                <th className="py-4.5 px-2 text-center w-14">Etapa</th>
                <th className="py-4.5 px-3">Llegada</th>
                <th className="py-4.5 px-3">Tiempo Neto</th>
                <th className="py-4.5 px-3">Diferencia</th>
                <th className="py-4.5 px-3">Velocidad Prom.</th>
                <th className="py-4.5 px-3">Toma de Pulso</th>
                <th className="py-4.5 px-2 text-center w-16">Pulso</th>
                <th className="py-4.5 px-3 text-center">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
              {filteredData.length > 0 ? (
                filteredData.map((entry) => {
                  const rankColors =
                    entry.rank === 1
                      ? "bg-amber-100 text-amber-950 border-amber-300"
                      : entry.rank === 2
                      ? "bg-slate-100 text-slate-900 border-slate-300"
                      : entry.rank === 3
                      ? "bg-orange-100 text-orange-950 border-orange-300"
                      : "bg-slate-50 text-slate-700 border-slate-200";

                  return (
                    <tr
                      key={entry.bibNumber}
                      className={`hover:bg-slate-50/50 transition-colors ${
                        entry.status === "DQ" ? "opacity-60 bg-red-50/10" : ""
                      }`}
                    >
                      {/* PUESTO */}
                      <td className="py-4.5 px-2 text-center font-bold">
                        <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full border text-xs font-black ${rankColors}`}>
                          {entry.rank}
                        </span>
                      </td>

                      {/* DORSAL */}
                      <td className="py-4.5 px-3 text-center">
                        <span className="inline-block bg-slate-900 text-white font-mono text-xs font-extrabold px-2.5 py-1 rounded-lg">
                          #{entry.bibNumber}
                        </span>
                      </td>

                      {/* BINOMIO */}
                      <td className="py-4.5 px-3">
                        <div className="flex flex-col">
                          <span className="font-extrabold text-slate-900 text-sm">
                            {entry.riderName}
                          </span>
                          <span className="text-xs text-slate-500 font-bold flex items-center mt-0.5 whitespace-nowrap">
                            <svg className="h-3 w-3 mr-1 text-[#AD8F6C]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                            </svg>
                            {entry.horseName}
                          </span>
                          {entry.startTime && (
                            <div className="flex mt-1 text-[10px] font-bold uppercase tracking-wide whitespace-nowrap">
                              <span className="inline-flex items-center text-blue-600 bg-blue-50 border border-blue-100 px-1.5 py-0.5 rounded-md whitespace-nowrap">
                                Salida: {formatHHMMSS(entry.startTime)}
                              </span>
                            </div>
                          )}
                        </div>
                      </td>

                      {/* ETAPA */}
                      <td className="py-4.5 px-2 text-center font-bold text-slate-800">
                        E{entry.currentStage}
                      </td>

                      {/* LLEGADA */}
                      <td className="py-4.5 px-3 font-mono font-bold text-emerald-600 whitespace-nowrap">
                        {formatHHMMSS(entry.arrivalTime)}
                      </td>

                      {/* TIEMPO NETO */}
                      <td className="py-4.5 px-3 font-mono font-bold text-slate-900 whitespace-nowrap">
                        {formatTime(entry.totalRaceTimeMs)}
                      </td>

                      {/* DIFERENCIA */}
                      <td className="py-4.5 px-3 font-mono text-xs text-slate-700 whitespace-nowrap">
                        {formatGap(entry.gapToLeaderMs, entry.totalRaceTimeMs)}
                      </td>

                      {/* VELOCIDAD PROMEDIO */}
                      <td className="py-4.5 px-3 font-bold text-slate-800 whitespace-nowrap">
                        {entry.averageSpeed ? `${entry.averageSpeed.toFixed(2)} km/h` : "--"}
                      </td>

                      {/* TOMA DE PULSO */}
                      <td className="py-4.5 px-3">
                        <div className="flex flex-col whitespace-nowrap">
                          <span className="font-mono font-bold text-slate-950 text-sm whitespace-nowrap">
                            {formatHHMMSS(entry.vetInTime)}
                          </span>
                          {entry.nextVetControlTime && (
                            <div className="flex mt-1 text-[10px] font-bold uppercase tracking-wide whitespace-nowrap">
                              <span className="inline-flex items-center text-amber-700 bg-amber-50 border border-amber-200/60 px-1.5 py-0.5 rounded-md whitespace-nowrap">
                                Límite: {formatHHMMSS(entry.nextVetControlTime)}
                              </span>
                            </div>
                          )}
                        </div>
                      </td>

                      {/* PULSO */}
                      <td className="py-4.5 px-2 text-center">
                        {entry.heartRate ? (
                           <span className={`inline-block font-mono font-extrabold text-xs px-2 py-1 rounded-lg whitespace-nowrap ${
                            entry.heartRate > 64
                              ? "bg-rose-100 text-rose-900 border border-rose-200"
                              : "bg-slate-100 text-slate-900 border border-slate-200"
                          }`}>
                            {entry.heartRate} ppm
                          </span>
                        ) : (
                          <span className="text-slate-400">--</span>
                        )}
                      </td>

                      {/* ESTADO */}
                      <td className="py-4.5 px-3 text-center">
                        {renderStatusBadge(entry.status)}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={11} className="py-12 px-6 text-center text-slate-500 font-medium">
                    No se encontraron binomios que coincidan con la búsqueda.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
