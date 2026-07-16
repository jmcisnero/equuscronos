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

interface LeaderboardTableProps {
  competitionId: string;
  searchQuery?: string;
  onErrorChange?: (hasError: boolean) => void;
  onValidatingChange?: (isValidating: boolean) => void;
  // Optional props for orchestration
  leaderboard?: LeaderboardEntry[];
  isLoading?: boolean;
  error?: any;
  isValidating?: boolean;
  isClosed?: boolean;
}

export default function LeaderboardTable({
  competitionId,
  searchQuery = "",
  onErrorChange,
  onValidatingChange,
  leaderboard: propsLeaderboard,
  isLoading: propsIsLoading,
  error: propsError,
  isValidating: propsIsValidating,
  isClosed: propsIsClosed,
}: LeaderboardTableProps) {
  // Consumir el hook si no se proveen las propiedades por parámetro
  const hookData = useLiveLeaderboard(competitionId);

  const leaderboard = propsLeaderboard !== undefined ? propsLeaderboard : hookData.leaderboard;
  const isLoading = propsIsLoading !== undefined ? propsIsLoading : hookData.isLoading;
  const error = propsError !== undefined ? propsError : hookData.error;
  const isValidating = propsIsValidating !== undefined ? propsIsValidating : hookData.isValidating;
  const isClosed = propsIsClosed !== undefined ? propsIsClosed : hookData.isClosed;

  // Control de estado reactivo para la fila expandida (Acordeón estricto)
  const [expandedRowId, setExpandedRowId] = React.useState<number | null>(null);

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

  // Datos reales del SWR
  const activeData = leaderboard;

  // Verificar si hay algún competidor en estado NO_COMPLETED
  const hasNoCompleted = React.useMemo(() => {
    return activeData.some((entry) => entry.status === "NO_COMPLETED");
  }, [activeData]);

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

  // AUDITORÍA RESPONSIVA Y CLS:
  // Renderizamos cargadores Skeletons con diseño espejo (Dual Layout Skeleton)
  // para evitar saltos bruscos de Cumulative Layout Shift (CLS) en celulares.
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
                <div className="h-5 w-12 bg-slate-200 rounded"></div>
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
      {isClosed && hasNoCompleted && (
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
              Control de Meta Cerrado (Tiempo Expirado)
            </h3>
            <p className="text-slate-600 text-xs mt-1">
              La carrera ha concluido. Aquellos binomios que no lograron completar la meta final dentro del tiempo límite reglamentario se registran como "No Completó" (NC).
            </p>
          </div>
        </div>
      )}
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

            const previousStages = (entry.stages || []).filter(
              (s) =>
                s.stageNumber < entry.currentStage ||
                entry.status === "FINISHED",
            );

            return (
              <div
                key={entry.bibNumber}
                onClick={() =>
                  setExpandedRowId(
                    expandedRowId === entry.bibNumber ? null : entry.bibNumber,
                  )
                }
                className={`bg-white border border-slate-200/60 rounded-3xl p-5 shadow-sm space-y-4 transition-all cursor-pointer hover:border-slate-300 hover:shadow-md ${entry.status === "DQ" ? "opacity-65 bg-slate-50/50" : ""
                  } ${expandedRowId === entry.bibNumber ? "ring-2 ring-slate-900/5 border-slate-350" : ""}`}
              >
                {/* Cabecera de la Tarjeta del Binomio */}
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

                {/* Información del Binomio con Alto Contraste para Lectura al Aire Libre */}
                <div className="space-y-1">
                  <h4 className="font-extrabold text-slate-900 text-base leading-tight">
                    {entry.riderName}
                  </h4>
                  <p className="text-xs text-slate-500 font-bold flex items-center">
                    Caballo: {entry.horseName}
                  </p>
                </div>

                {/* Grid de Estadísticas Técnicas del Binomio */}
                <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-100 text-xs">
                  <div>
                    <span className="text-slate-400 block font-bold text-[9px] uppercase tracking-wider">
                      Etapa
                    </span>
                    <span className="font-extrabold text-slate-800">
                      Etapa {entry.currentStage}
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
                        ? `${entry.averageSpeed.toFixed(2)} km/h`
                        : "--"}
                    </span>
                  </div>

                  {entry.startTime && (
                    <div>
                      <span className="text-slate-400 block font-bold text-[9px] uppercase tracking-wider">
                        Hora Salida
                      </span>
                      <span className="font-sans tabular-nums font-bold text-[#1C4F38]">
                        {formatHHMMSS(entry.startTime)}
                      </span>
                    </div>
                  )}
                  {entry.arrivalTime && (
                    <div>
                      <span className="text-slate-400 block font-bold text-[9px] uppercase tracking-wider">
                        Hora Llegada
                      </span>
                      <span className="font-sans tabular-nums font-bold text-[#1C4F38]">
                        {formatHHMMSS(entry.arrivalTime)}
                      </span>
                    </div>
                  )}
                  {entry.vetInTime && (
                    <div>
                      <span className="text-slate-400 block font-bold text-[9px] uppercase tracking-wider">
                        Toma de Pulso
                      </span>
                      <span className="font-sans tabular-nums text-slate-800">
                        {formatHHMMSS(entry.vetInTime)}
                      </span>
                    </div>
                  )}
                  {entry.nextVetControlTime && !isClosed && (
                    <div>
                      <span className="text-slate-400 block font-bold text-[9px] uppercase tracking-wider">
                        Límite Vet Gate
                      </span>
                      <span className="font-sans tabular-nums font-bold text-[#AD8F6C]">
                        {formatHHMMSS(entry.nextVetControlTime)}
                      </span>
                    </div>
                  )}

                  {/* Frecuencia cardíaca (Pulso) conforme límites FEU */}
                  {entry.heartRate && (
                    <div className="col-span-2 pt-2 border-t border-dashed border-slate-100 flex justify-between items-center">
                      <span className="text-slate-400 font-bold text-[9px] uppercase tracking-wider">
                        Pulsaciones (Límite 60/64 FEU)
                      </span>
                      <span
                        className={`font-sans tabular-nums font-black px-2.5 py-1 rounded-lg text-xs ${entry.heartRate > 64
                            ? "bg-rose-100 text-rose-900 border border-rose-200"
                            : "bg-slate-100 text-slate-900 border border-slate-200"
                          }`}
                      >
                        {entry.heartRate} ppm
                      </span>
                    </div>
                  )}
                </div>

                {/* Historial de Etapas Anteriores (Bitácora Móvil) */}
                <div
                  className={`transition-all duration-300 ease-in-out overflow-hidden ${expandedRowId === entry.bibNumber
                      ? "max-h-[800px] opacity-100 pt-4 border-t border-slate-100"
                      : "max-h-0 opacity-0 pointer-events-none"
                    }`}
                  onClick={(e) => e.stopPropagation()} // Evita cerrar el acordeón al hacer clic dentro
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
                    Historial de Etapas Anteriores (Detalle Clínico)
                  </h5>
                  <StageHistoryMobile stages={previousStages} />
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
                <th className="py-4.5 px-2 text-center w-24">Vel. Prom.</th>
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

                  const previousStages = (entry.stages || []).filter(
                    (s) =>
                      s.stageNumber < entry.currentStage ||
                      entry.status === "FINISHED",
                  );

                  return (
                    <React.Fragment key={entry.bibNumber}>
                      <tr
                        onClick={() =>
                          setExpandedRowId(
                            expandedRowId === entry.bibNumber
                              ? null
                              : entry.bibNumber,
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
                            <span className="font-extrabold text-slate-900 text-sm">
                              {entry.riderName}
                            </span>
                            <span className="text-xs text-slate-500 font-bold flex items-center mt-0.5 whitespace-nowrap">
                              {entry.horseName}
                            </span>
                            {entry.startTime && (
                              <div className="flex mt-1 text-[10px] font-bold uppercase tracking-wide whitespace-nowrap">
                                <span className="inline-flex items-center text-[#1C4F38] bg-[#1C4F38]/10 border border-[#1C4F38]/20 px-1.5 py-0.5 rounded-md whitespace-nowrap">
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
                            entry.totalRaceTimeMs,
                          )}
                        </td>

                        {/* VELOCIDAD PROMEDIO */}
                        <td className="py-4.5 px-2 text-center text-slate-800 whitespace-nowrap">
                          {entry.averageSpeed
                            ? `${entry.averageSpeed.toFixed(2)} km/h`
                            : "--"}
                        </td>

                        {/* TOMA DE PULSO */}
                        <td className="py-4.5 px-3">
                          <div className="flex flex-col whitespace-nowrap">
                            <span className="font-sans tabular-nums text-slate-950 text-sm whitespace-nowrap">
                              {formatHHMMSS(entry.vetInTime)}
                            </span>
                            {entry.nextVetControlTime && !isClosed && (
                              <div className="flex mt-1 text-[10px] font-bold uppercase tracking-wide whitespace-nowrap">
                                <span className="inline-flex items-center text-[#AD8F6C] bg-[#AD8F6C]/10 border border-[#AD8F6C]/20 px-1.5 py-0.5 rounded-md whitespace-nowrap">
                                  Límite:{" "}
                                  {formatHHMMSS(entry.nextVetControlTime)}
                                </span>
                              </div>
                            )}
                          </div>
                        </td>

                        {/* PULSO */}
                        <td className="py-4.5 px-2 text-center">
                          {entry.heartRate ? (
                            <span
                              className={`inline-block font-sans tabular-nums font-extrabold text-xs px-2 py-1 rounded-lg whitespace-nowrap ${entry.heartRate > 64
                                  ? "bg-rose-100 text-rose-900 border border-rose-200"
                                  : "bg-slate-100 text-slate-900 border border-slate-200"
                                }`}
                            >
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

                      {/* Fila Secundaria del Acordeón (Detalle de Fases Pasadas) */}
                      <tr
                        key={`expanded-${entry.bibNumber}`}
                        className="bg-slate-50/30"
                      >
                        <td colSpan={11} className="p-0 border-none">
                          <div
                            className={`transition-all duration-300 ease-in-out overflow-hidden ${expandedRowId === entry.bibNumber
                                ? "max-h-[500px] opacity-100 border-b border-slate-100"
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
                                Historial de Etapas Anteriores (Detalle Clínico)
                              </h5>
                              <StageHistoryTable stages={previousStages} />
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
                    colSpan={11}
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
