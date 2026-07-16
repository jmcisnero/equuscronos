"use client";

import React from "react";
import {
  useLiveLeaderboard,
  LeaderboardEntry,
} from "../hooks/useLiveLeaderboard";
import {
  ClubJersey,
  formatHHMMSS,
  formatTime,
  formatGap,
  renderStatusBadge,
  StageHistoryMobile,
  StageHistoryTable,
} from "./LeaderboardShared";

interface FinalResultsTableProps {
  competitionId: string;
  searchQuery?: string;
  onErrorChange?: (hasError: boolean) => void;
  onValidatingChange?: (isValidating: boolean) => void;
  // Props opcionales provistas por el componente orquestador
  leaderboard?: LeaderboardEntry[];
  isLoading?: boolean;
  error?: any;
  isValidating?: boolean;
  maxHeartRate?: number;
}

export default function FinalResultsTable({
  competitionId,
  searchQuery = "",
  onErrorChange,
  onValidatingChange,
  leaderboard: propsLeaderboard,
  isLoading: propsIsLoading,
  error: propsError,
  isValidating: propsIsValidating,
  maxHeartRate = 65,
}: FinalResultsTableProps) {
  // Consumir el hook si no se proveen las propiedades por parámetro
  const hookData = useLiveLeaderboard(competitionId);

  const leaderboard = propsLeaderboard !== undefined ? propsLeaderboard : hookData.leaderboard;
  const isLoading = propsIsLoading !== undefined ? propsIsLoading : hookData.isLoading;
  const error = propsError !== undefined ? propsError : hookData.error;
  const isValidating = propsIsValidating !== undefined ? propsIsValidating : hookData.isValidating;

  // Control de fila expandida
  const [expandedRowId, setExpandedRowId] = React.useState<number | null>(null);

  // Informar al layout root sobre errores
  React.useEffect(() => {
    if (onErrorChange) {
      onErrorChange(!!error);
    }
  }, [error, onErrorChange]);

  // Notificar al componente padre sobre la validación
  React.useEffect(() => {
    if (onValidatingChange) {
      onValidatingChange(isValidating);
    }
  }, [isValidating, onValidatingChange]);

  // Verificar si hay algún competidor en estado NO_COMPLETED
  const hasNoCompleted = React.useMemo(() => {
    return leaderboard.some((entry) => entry.status === "NO_COMPLETED");
  }, [leaderboard]);

  // Filtrado multivariable
  const filteredData = React.useMemo(() => {
    return leaderboard.filter((entry) => {
      const query = searchQuery.toLowerCase().trim();
      if (!query) return true;
      return (
        entry.riderName.toLowerCase().includes(query) ||
        entry.horseName.toLowerCase().includes(query) ||
        entry.bibNumber.toString().includes(query)
      );
    });
  }, [leaderboard, searchQuery]);

  // Calcular la suma de distancias (Kms) de cada binomio usando useMemo
  const entriesWithCalculatedKms = React.useMemo(() => {
    return filteredData.map((entry) => {
      const totalKms = (entry.stages || []).reduce(
        (sum, stage) => sum + (stage.distanceKm || 0),
        0
      );
      return {
        ...entry,
        totalKms,
      };
    });
  }, [filteredData]);

  // Algoritmo del Trofeo FEU (Art. 42)
  const feuTrophyWinnerBib = React.useMemo(() => {
    // Paso 1: Filtrar clasificados
    const classified = leaderboard.filter(
      (entry) =>
        entry.status === "FINISHED" ||
        entry.status === "FINISHED_PROVISIONAL" ||
        (entry.rank !== null && entry.rank !== undefined && entry.rank > 0)
    );

    // Paso 2: Mapear a dorsal, pulso de etapa 1 y rank
    const candidates = classified
      .map((entry) => {
        const stage1 = entry.stages?.find((s) => s.stageNumber === 1);
        const pulse = stage1?.heartRate;
        return {
          bibNumber: entry.bibNumber,
          pulse: pulse !== undefined && pulse !== null && !isNaN(pulse) ? pulse : null,
          rank: entry.rank !== null && entry.rank !== undefined ? entry.rank : Infinity,
        };
      })
      .filter((c) => c.pulse !== null) as { bibNumber: number; pulse: number; rank: number }[];

    if (candidates.length === 0) return null;

    // Paso 3: Encontrar el pulso mínimo
    const minPulse = Math.min(...candidates.map((c) => c.pulse));

    // Paso 4: Resolver empates por mejor rank (número menor)
    const minPulseCandidates = candidates.filter((c) => c.pulse === minPulse);
    if (minPulseCandidates.length === 0) return null;

    minPulseCandidates.sort((a, b) => a.rank - b.rank);

    return minPulseCandidates[0].bibNumber;
  }, [leaderboard]);

  // Renderizador de la columna especial de Pulso
  const renderStage1Pulse = (entry: LeaderboardEntry) => {
    const stage1 = entry.stages?.find((s) => s.stageNumber === 1);
    const pulse = stage1?.heartRate;

    if (pulse === undefined || pulse === null) {
      return <span className="text-slate-400 font-bold">—</span>;
    }

    const isWinner = entry.bibNumber === feuTrophyWinnerBib;
    const isHigh = pulse > maxHeartRate;

    let heartColorClass = "";
    if (isWinner) {
      heartColorClass = "text-amber-500 hover:text-amber-600"; // Oro / Dorado
    } else if (isHigh) {
      heartColorClass = "text-rose-500 hover:text-rose-600"; // Rojo (Peligro)
    } else {
      heartColorClass = "text-equus-green hover:text-[#153B29]"; // Verde de la paleta de colores de equuscronos (#1C4F38)
    }

    return (
      <div className="flex items-center justify-center space-x-0.5">
        {isWinner && (
          <span
            title="Ganador del Trofeo FEU (Mejor Pulso de Etapa 1)"
            className="text-base select-none leading-none z-10"
          >
            🏆
          </span>
        )}
        <div className="relative inline-flex items-center justify-center w-10 h-10 group">
          <svg
            className={`w-10 h-10 ${heartColorClass} fill-current transition-colors drop-shadow-sm`}
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-[10px] font-black text-white select-none mt-[-1px]">
            {pulse}
          </span>
        </div>
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        {/* Skeleton de Escritorio (Desktop Table Skeleton) */}
        <div className="hidden md:block bg-white border border-slate-200/60 rounded-3xl shadow-sm overflow-hidden">
          <div className="bg-slate-50 border-b border-slate-100 h-14 w-full animate-pulse"></div>
          <div className="divide-y divide-slate-100">
            {[1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className="h-18 px-6 flex items-center justify-between space-x-6 animate-pulse"
              >
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
                <div className="h-8 w-24 bg-slate-200 rounded-full"></div>
              </div>
            ))}
          </div>
        </div>

        {/* Skeleton de Móvil (Mobile Cards Skeleton) */}
        <div className="block md:hidden space-y-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="bg-white border border-slate-200/60 rounded-3xl p-5 space-y-4 animate-pulse"
            >
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
      {hasNoCompleted && (
        <div className="bg-slate-100 text-slate-800 rounded-3xl p-5 border border-slate-200 flex items-start space-x-4">
          <div className="p-2 rounded-xl bg-slate-200 text-slate-600 flex-shrink-0">
            <svg
              className="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2.5}
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <div>
            <h3 className="text-base font-black tracking-tight leading-tight text-slate-900">
              Resultados Oficiales - Control de Meta Cerrado
            </h3>
            <p className="text-slate-600 text-xs mt-1">
              La carrera ha concluido. Aquellos binomios que no lograron completar la meta final dentro del tiempo límite reglamentario se registran como "No Completó" (NC).
            </p>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* VISTA MÓVIL (MOBILE CARD VIEW)                                            */}
      {/* ========================================================================= */}
      <div className="block md:hidden space-y-4">
        {entriesWithCalculatedKms.length > 0 ? (
          entriesWithCalculatedKms.map((entry) => {
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
                onClick={() =>
                  setExpandedRowId(
                    expandedRowId === entry.bibNumber ? null : entry.bibNumber
                  )
                }
                className={`bg-white border border-slate-200/60 rounded-3xl p-5 shadow-sm space-y-4 transition-all cursor-pointer hover:border-slate-300 hover:shadow-md ${entry.status === "DQ" ? "opacity-65 bg-slate-50/50" : ""
                  } ${expandedRowId === entry.bibNumber ? "ring-2 ring-slate-900/5 border-slate-350" : ""}`}
              >
                {/* Cabecera */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <svg
                      className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-300 ${expandedRowId === entry.bibNumber ? "rotate-180" : ""
                        }`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2.5}
                        d="M19 9l-7 7-7-7"
                      />
                    </svg>
                    {entry.rank ? (
                      <span
                        className={`inline-flex items-center justify-center w-8 h-8 rounded-full border text-xs font-black ${rankBg}`}
                      >
                        {entry.rank}
                      </span>
                    ) : (
                      <span className="inline-flex items-center justify-center w-8 h-8 text-slate-400 font-sans tabular-nums text-sm">
                        --
                      </span>
                    )}
                    <div className="flex items-center space-x-1.5">
                      <ClubJersey representedTenant={entry.representedTenant} />
                      <span className="bg-slate-950 text-white font-sans tabular-nums text-xs font-extrabold px-2 py-1 rounded-lg">
                        #{entry.bibNumber}
                      </span>
                    </div>
                  </div>
                  {renderStatusBadge(entry.status)}
                </div>

                {/* Binomio */}
                <div className="space-y-1">
                  <h4 className="font-extrabold text-slate-900 text-xs leading-tight">
                    {entry.riderName}
                  </h4>
                  <p className="text-xs text-slate-500 font-bold flex items-center">
                    Equino: {entry.horseName}
                  </p>
                  {entry.representedTenant?.name && (
                    <p className="text-[10px] text-slate-400 font-medium mt-0.5">
                      {entry.representedTenant.name}
                    </p>
                  )}
                </div>

                {/* Grid Estadístico */}
                <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-100 text-xs">
                  <div>
                    <span className="text-slate-400 block font-bold text-[9px] uppercase tracking-wider">
                      Distancia Total
                    </span>
                    <span className="font-extrabold text-slate-800">
                      {entry.totalKms.toFixed(1)} km
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-bold text-[9px] uppercase tracking-wider">
                      Tiempo Neto
                    </span>
                    <span className="font-sans tabular-nums font-medium text-slate-900">
                      {formatTime(entry.totalRaceTimeMs)}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-bold text-[9px] uppercase tracking-wider">
                      Diferencia
                    </span>
                    <span className="font-sans tabular-nums font-bold text-slate-900">
                      {formatGap(entry.gapToLeaderMs, entry.totalRaceTimeMs)}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-bold text-[9px] uppercase tracking-wider">
                      Velocidad Promedio
                    </span>
                    <span className="text-slate-800">
                      {entry.averageSpeed
                        ? `${entry.averageSpeed.toFixed(3)} km/h`
                        : "--"}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-bold text-[9px] uppercase tracking-wider">
                      Pulso
                    </span>
                    <div className="mt-1 flex items-center">
                      {renderStage1Pulse(entry)}
                    </div>
                  </div>

                  {entry.arrivalTime && (
                    <div>
                      <span className="text-slate-400 block font-bold text-[9px] uppercase tracking-wider">
                        Hora Llegada Meta
                      </span>
                      <span className="font-sans tabular-nums font-bold text-[#1C4F38]">
                        {formatHHMMSS(entry.arrivalTime)}
                      </span>
                    </div>
                  )}
                </div>

                {/* Acordeón Móvil (Historial clínico completo) */}
                <div
                  className={`transition-all duration-300 ease-in-out overflow-hidden ${expandedRowId === entry.bibNumber
                      ? "max-h-[800px] opacity-100 pt-4 border-t border-slate-100"
                      : "max-h-0 opacity-0 pointer-events-none"
                    }`}
                  onClick={(e) => e.stopPropagation()}
                >
                  <h5 className="font-extrabold text-slate-800 text-xs mb-3 uppercase tracking-wider flex items-center">
                    <svg
                      className="w-4 h-4 mr-1.5 text-[#AD8F6C]"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2.5}
                        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    Historial de Etapas (Detalle Clínico)
                  </h5>
                  <StageHistoryMobile stages={entry.stages || []} />
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
      {/* ========================================================================= */}
      <div className="hidden md:block bg-white border border-slate-200/60 rounded-3xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse table-fixed">
            {/* 
              Establecer las proporciones de las columnas mediante <colgroup>.
              Distribuimos el ancho extra equitativamente para acomodar la columna de Pulso.
            */}
            <colgroup>
              <col className="w-12" /> {/* Pos. */}
              <col className="w-16" /> {/* Dorsal */}
              <col className="w-[28%]" /> {/* Binomio */}
              <col className="w-16" /> {/* Kms */}
              <col className="w-[12%]" /> {/* Llegada */}
              <col className="w-[20%]" /> {/* Tiempo Neto */}
              <col className="w-[12%]" /> {/* Diferencia */}
              <col className="w-24" /> {/* Vel. Prom. */}
              <col className="w-24" /> {/* Pulso */}
              <col className="w-24" /> {/* Estado */}
            </colgroup>
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 text-xs font-bold uppercase tracking-wider">
                <th className="py-4.5 px-2 text-center">Pos.</th>
                <th className="py-4.5 px-3 text-center">Dorsal</th>
                <th className="py-4.5 px-3">Binomio</th>
                <th className="py-4.5 px-2 text-center">Kms</th>
                <th className="py-4.5 px-3">Llegada</th>
                <th className="py-4.5 px-3">Tiempo Neto</th>
                <th className="py-4.5 px-3">Diferencia</th>
                <th className="py-4.5 px-2 text-center">Vel. Prom.</th>
                <th className="py-4.5 px-3 text-center">Pulso</th>
                <th className="py-4.5 px-3 text-center">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
              {entriesWithCalculatedKms.length > 0 ? (
                entriesWithCalculatedKms.map((entry) => {
                  const rankColors =
                    entry.rank === 1
                      ? "bg-amber-100 text-amber-950 border-amber-300"
                      : entry.rank === 2
                        ? "bg-slate-100 text-slate-900 border-slate-300"
                        : entry.rank === 3
                          ? "bg-orange-100 text-orange-950 border-orange-300"
                          : "bg-slate-50 text-slate-700 border-slate-200";

                  return (
                    <React.Fragment key={entry.bibNumber}>
                      <tr
                        onClick={() =>
                          setExpandedRowId(
                            expandedRowId === entry.bibNumber
                              ? null
                              : entry.bibNumber
                          )
                        }
                        className={`cursor-pointer hover:bg-slate-50/80 transition-colors ${expandedRowId === entry.bibNumber
                            ? "bg-slate-50/70"
                            : ""
                          } ${entry.status === "DQ" ? "opacity-60 bg-red-50/10" : ""
                          }`}
                      >
                        {/* PUESTO */}
                        <td className="py-4.5 px-2 text-center font-bold">
                          <div className="flex items-center justify-center space-x-1.5">
                            <svg
                              className={`w-3 h-3 text-slate-400 transition-transform duration-300 ${expandedRowId === entry.bibNumber
                                  ? "rotate-180"
                                  : ""
                                }`}
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2.5}
                                d="M19 9l-7 7-7-7"
                              />
                            </svg>
                            {entry.rank ? (
                              <span
                                className={`inline-flex items-center justify-center w-8 h-8 rounded-full border text-xs font-black ${rankColors}`}
                              >
                                {entry.rank}
                              </span>
                            ) : (
                              <span className="text-slate-400 font-sans tabular-nums text-sm">
                                --
                              </span>
                            )}
                          </div>
                        </td>

                        {/* DORSAL */}
                        <td className="py-4.5 px-3 text-center">
                          <div className="flex flex-col items-center space-y-1.5">
                            <ClubJersey
                              representedTenant={entry.representedTenant}
                            />
                            <span className="inline-block bg-slate-900 text-white font-sans tabular-nums text-xs font-extrabold px-2.5 py-1 rounded-lg">
                              #{entry.bibNumber}
                            </span>
                          </div>
                        </td>

                        {/* BINOMIO */}
                        <td className="py-4.5 px-3">
                          <div className="flex flex-col">
                            <span className="font-extrabold text-slate-900 text-xs">
                              {entry.riderName}
                            </span>
                            <span className="text-xs text-slate-500 font-bold flex items-center mt-0.5 whitespace-nowrap">
                              {entry.horseName}
                            </span>
                            {entry.representedTenant?.name && (
                              <span className="text-[10px] text-slate-400 font-medium mt-0.5 whitespace-nowrap">
                                {entry.representedTenant.name}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* KMS */}
                        <td className="py-4.5 px-2 text-center font-bold text-slate-800">
                          {entry.totalKms.toFixed(1)}
                        </td>

                        {/* LLEGADA */}
                        <td className="py-4.5 px-3 font-sans tabular-nums font-bold text-[#1C4F38] whitespace-nowrap">
                          {formatHHMMSS(entry.arrivalTime)}
                        </td>

                        {/* TIEMPO NETO */}
                        <td className="py-4.5 px-3 font-sans tabular-nums font-medium text-slate-900 whitespace-nowrap">
                          {formatTime(entry.totalRaceTimeMs)}
                        </td>

                        {/* DIFERENCIA */}
                        <td className="py-4.5 px-3 font-sans tabular-nums text-xs text-slate-700 whitespace-nowrap">
                          {formatGap(
                            entry.gapToLeaderMs,
                            entry.totalRaceTimeMs
                          )}
                        </td>

                        {/* VELOCIDAD PROMEDIO */}
                        <td className="py-4.5 px-2 text-center text-slate-800 whitespace-nowrap font-medium">
                          {entry.averageSpeed
                            ? `${entry.averageSpeed.toFixed(3)} km/h`
                            : "--"}
                        </td>

                        {/* PULSO */}
                        <td className="py-4.5 px-3 text-center">
                          {renderStage1Pulse(entry)}
                        </td>

                        {/* ESTADO */}
                        <td className="py-4.5 px-3 text-center">
                          {renderStatusBadge(entry.status)}
                        </td>
                      </tr>

                      {/* Fila Secundaria del Acordeón (Detalle de Fases Pasadas Clínico) */}
                      <tr
                        key={`expanded-${entry.bibNumber}`}
                        className="bg-slate-50/30"
                      >
                        {/* El colSpan debe ser 10 para coincidir con la grilla de esta tabla */}
                        <td colSpan={10} className="p-0 border-none">
                          <div
                            className={`transition-all duration-300 ease-in-out overflow-hidden ${expandedRowId === entry.bibNumber
                                ? "max-h-[600px] opacity-100 border-b border-slate-100"
                                : "max-h-0 opacity-0 pointer-events-none"
                              }`}
                          >
                            <div className="p-6 bg-slate-50/60 shadow-inner">
                              <h5 className="font-extrabold text-slate-800 text-xs mb-3 uppercase tracking-wider flex items-center">
                                <svg
                                  className="w-4 h-4 mr-1.5 text-[#AD8F6C]"
                                  fill="none"
                                  viewBox="0 0 24 24"
                                  stroke="currentColor"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2.5}
                                    d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                                  />
                                </svg>
                                Historial de Etapas (Trazabilidad Clínicas Completa y Auditoría FEU)
                              </h5>
                              <StageHistoryTable stages={entry.stages || []} />
                            </div>
                          </div>
                        </td>
                      </tr>
                    </React.Fragment>
                  );
                })
              ) : (
                <tr>
                  <td
                    colSpan={10}
                    className="py-12 px-6 text-center text-slate-500 font-medium"
                  >
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
