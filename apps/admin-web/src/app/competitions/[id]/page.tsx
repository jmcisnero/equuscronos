"use client";

import React, { use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CompetitionService } from "@/services/api/competition.service";
import LiveLeaderboardContingency from "./LiveLeaderboardContingency";

export default function CompetitionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const id = resolvedParams.id;
  const router = useRouter();
  const queryClient = useQueryClient();

  // Fetch de la competencia por ID
  const {
    data: comp,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["competition", id],
    queryFn: () => CompetitionService.getById(id),
    enabled: !!id,
    retry: 1,
  });

  // Calcular la distancia total recorrida
  const getDistanceTotal = (stages?: any[]) => {
    if (!stages || stages.length === 0) return "0.00 km";
    const total = stages.reduce(
      (acc, stage) => acc + parseFloat(stage.distanceKm),
      0,
    );
    return `${total.toFixed(2)} km`;
  };

  // Renderizador de Estado de Carga (Skeleton Premium)
  if (isLoading) {
    return (
      <div className="space-y-8 animate-pulse p-2">
        {/* Breadcrumb Skeleton */}
        <div className="h-4 w-48 bg-slate-200 rounded-md"></div>

        {/* Cabecera Skeleton */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
          <div className="space-y-2">
            <div className="h-8 w-80 bg-slate-200 rounded-lg"></div>
            <div className="h-4 w-96 bg-slate-200 rounded-md"></div>
          </div>
          <div className="h-10 w-32 bg-slate-200 rounded-xl"></div>
        </div>

        {/* Grid Body Skeletons */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
            <div className="h-64 bg-slate-200 rounded-2xl"></div>
            <div className="h-48 bg-slate-200 rounded-2xl"></div>
          </div>
          <div className="space-y-8">
            <div className="h-48 bg-slate-200 rounded-2xl"></div>
            <div className="h-32 bg-slate-200 rounded-2xl"></div>
          </div>
        </div>
      </div>
    );
  }

  // Renderizador de Errores (403/404 y fallos de API)
  if (error || !comp) {
    const errorMsg =
      error instanceof Error
        ? error.message
        : "No se pudo encontrar el evento especificado o no cuenta con los permisos necesarios.";
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center p-6 text-center max-w-lg mx-auto">
        <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl text-rose-600 mb-6 shadow-sm">
          <svg
            className="w-12 h-12 mx-auto"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        </div>
        <h3 className="text-xl font-extrabold text-slate-800 tracking-tight mb-2">
          Evento no Encontrado
        </h3>
        <p className="text-sm text-slate-500 leading-relaxed mb-6">
          {errorMsg}
        </p>
        <button
          onClick={() => router.push("/competitions")}
          className="inline-flex items-center justify-center px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-bold text-sm rounded-xl transition-all shadow-md"
        >
          Volver al Calendario
        </button>
      </div>
    );
  }

  const displayDate = comp.competitionDate
    ? comp.competitionDate.substring(0, 10)
    : "-";

  return (
    <div className="space-y-8">
      {/* 1. BREADCRUMBS Y NAVEGACIÓN */}
      <nav className="flex items-center space-x-2 text-xs font-bold text-slate-400 uppercase tracking-wider">
        <Link
          href="/competitions"
          className="hover:text-equus-green transition-colors"
        >
          Calendario
        </Link>
        <svg
          className="w-3 h-3 text-slate-300"
          fill="none"
          stroke="currentColor"
          strokeWidth={3}
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
        <span className="text-slate-600 truncate max-w-[200px]">
          {comp.name}
        </span>
      </nav>

      {/* 2. HEADER CON ENCABEZADO Y BADGES */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between space-y-4 sm:space-y-0 pb-6 border-b border-slate-100">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-extrabold text-slate-800 tracking-tight mr-2">
              {comp.name}
            </h1>

            {/* Badge de Federado */}
            <span
              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-extrabold border ${
                comp.isFederated
                  ? "bg-amber-50 text-amber-700 border-amber-200/50"
                  : "bg-slate-50 text-slate-500 border-slate-200/50"
              }`}
            >
              {comp.isFederated ? "🏆 FEU Federado" : "Evento Social"}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-slate-500">
            {/* Ubicación */}
            <div className="flex items-center space-x-1.5">
              <svg
                className="w-4 h-4 text-slate-400"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
              <span>{comp.location || "No especificada"}</span>
            </div>

            {/* Fecha */}
            <div className="flex items-center space-x-1.5 font-sans tabular-nums">
              <svg
                className="w-4 h-4 text-slate-400"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
              <span>{displayDate}</span>
            </div>

            {/* Hora de Largada */}
            <div className="flex items-center space-x-1.5 font-sans tabular-nums">
              <svg
                className="w-4 h-4 text-slate-400"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
                />
              </svg>
              <span>
                {comp.startTime ? comp.startTime.substring(0, 5) : "07:00"} hs
              </span>
            </div>
          </div>
        </div>

        {/* Estado Actual de la Competencia */}
        <div className="flex items-center space-x-3">
          <span
            className={`inline-flex rounded-xl px-4 py-2 text-xs font-extrabold border shadow-sm ${
              comp.status === "ACTIVE"
                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                : comp.status === "COMPLETED" || comp.status === "OFFICIAL"
                  ? "bg-blue-50 text-blue-700 border-blue-200"
                  : "bg-amber-50 text-amber-700 border-amber-200"
            }`}
          >
            {comp.status === "ACTIVE"
              ? "🟢 EN CARRERA"
              : comp.status === "PLANNED"
                ? "📅 PLANIFICADO"
                : `🏁 ${comp.status}`}
          </span>
        </div>
      </div>

      {/* 3. GRID PRINCIPAL DE CONTENIDOS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Columna Izquierda: Configuración de Etapas */}
        <div className="lg:col-span-2 space-y-8">
          {/* Tarjeta de Etapas */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="px-6 py-5 border-b border-slate-50 flex items-center justify-between bg-slate-50/50">
              <div>
                <h3 className="text-base font-extrabold text-slate-800">
                  Plan de Carrera y Etapas
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Vet Gates reglamentarios configurados para el evento
                </p>
              </div>
              <span className="text-xs font-extrabold text-slate-900 bg-white border border-slate-200 px-3 py-1.5 rounded-xl font-sans tabular-nums shadow-sm">
                Total: {getDistanceTotal(comp.stages)}
              </span>
            </div>

            <div className="p-6">
              {!comp.stages || comp.stages.length === 0 ? (
                <div className="text-center py-12 text-slate-400 text-sm">
                  No hay etapas configuradas para este evento de raid.
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Timeline Horizontal / Lista de Etapas */}
                  <div className="relative border-l-2 border-slate-100 pl-6 ml-3 space-y-8">
                    {comp.stages
                      .sort((a, b) => a.stageNumber - b.stageNumber)
                      .map((stage, idx) => (
                        <div key={stage.id} className="relative">
                          {/* Nodo del Timeline */}
                          <span className="absolute -left-[35px] top-1 flex items-center justify-center w-6.5 h-6.5 rounded-full bg-white border-2 border-equus-green text-[10px] font-extrabold text-slate-800 font-sans tabular-nums shadow-sm">
                            {stage.stageNumber}
                          </span>

                          <div className="bg-slate-50/70 hover:bg-slate-50 border border-slate-100/50 p-4 rounded-xl transition-all flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                            <div>
                              <h4 className="text-sm font-bold text-slate-800">
                                Etapa {stage.stageNumber} - Vet Gate
                              </h4>
                              <p className="text-xs text-slate-400 mt-0.5">
                                Requerimiento: Recuperación cardíaca a menos de{" "}
                                {comp.maxHeartRate || 65} ppm
                              </p>
                            </div>

                            <div className="flex items-center space-x-6">
                              {/* Distancia de la Etapa */}
                              <div>
                                <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                  Distancia
                                </span>
                                <span className="text-sm font-extrabold text-slate-900 font-sans tabular-nums">
                                  {stage.distanceKm} km
                                </span>
                              </div>

                              {/* Neutralización */}
                              <div>
                                <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                  Neut.
                                </span>
                                <span className="text-sm font-extrabold text-slate-600 font-sans tabular-nums">
                                  {stage.neutralizationMinutes} min
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <LiveLeaderboardContingency
            competitionId={comp.id}
            stages={comp.stages || []}
          />
        </div>

        {/* Columna Derecha: Acciones Rápidas y Reglas */}
        <div className="space-y-8">
          {/* Centro de Control de Carrera (Lógica Habilitación y Largada) */}
          <ControlCenter
            comp={comp}
            queryClient={queryClient}
            router={router}
          />

          {/* Tarjeta de Acceso Rápido a Start List */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-4 flex flex-col">
            <div className="p-3.5 bg-emerald-50 rounded-xl text-equus-green w-fit">
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                strokeWidth={2.2}
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                />
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-slate-800">
                Planilla y Start List
              </h3>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                Inscribir binomios participantes, registrar precintos oficiales
                FEU, lastres de báscula y controlar la admisión deportiva.
              </p>
            </div>

            <Link
              href={`/competitions/${comp.id}/start-list`}
              className="mt-2 w-full inline-flex items-center justify-center px-4 py-3 bg-equus-green hover:bg-opacity-95 text-white font-bold text-sm rounded-xl transition-all shadow-md hover:shadow-lg text-center"
            >
              Gestionar Start List
            </Link>
          </div>

          {/* Tarjeta de Límites Médicos */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-4">
            <div>
              <h3 className="text-sm font-extrabold text-slate-800">
                Límites y Reglas Sanitarias
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Parámetros aplicados para Vet Check
              </p>
            </div>

            <div className="divide-y divide-slate-50 text-xs">
              <div className="py-2.5 flex items-center justify-between">
                <span className="text-slate-500 font-medium">
                  Frecuencia Cardíaca Máxima
                </span>
                <span className="font-extrabold text-slate-800 font-sans tabular-nums">
                  {comp.maxHeartRate || 65} ppm
                </span>
              </div>
              <div className="py-2.5 flex items-center justify-between">
                <span className="text-slate-500 font-medium">
                  Habilitación de Lastre
                </span>
                <span className="font-extrabold text-emerald-600 font-sans tabular-nums">
                  85.00 kg (Art. 20)
                </span>
              </div>
              <div className="py-2.5 flex items-center justify-between">
                <span className="text-slate-500 font-medium">
                  Tipo de Regulación
                </span>
                <span className="font-extrabold text-slate-800">
                  Reglamento FEU
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

interface ControlCenterProps {
  comp: any;
  queryClient: any;
  router: any;
}

function ControlCenter({ comp, queryClient, router }: ControlCenterProps) {
  const [currentTime, setCurrentTime] = React.useState(new Date());
  const [officialStartTime, setOfficialStartTime] = React.useState<string>("");
  const [isStarting, setIsStarting] = React.useState(false);
  const [startError, setStartError] = React.useState<string | null>(null);
  const [pendingConfirmWd, setPendingConfirmWd] = React.useState(false);
  const [missingCompetitors, setMissingCompetitors] = React.useState<any[]>([]);

  React.useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  React.useEffect(() => {
    if (comp) {
      const compDateStr = comp.competitionDate
        ? comp.competitionDate.substring(0, 10)
        : "";
      const defaultTimeStr = `${compDateStr}T${comp.startTime || "07:00:00"}`;
      setOfficialStartTime(defaultTimeStr);
    }
  }, [comp]);

  if (!comp) return null;

  const compDateStr = comp.competitionDate
    ? comp.competitionDate.substring(0, 10)
    : "";

  // Largada programada: Dynamic "Hora Cero" AM (local uruguayo, GMT-3)
  const scheduledTime = new Date(
    `${compDateStr}T${comp.startTime || "07:00:00"}-03:00`,
  );

  // Diferencia de milisegundos
  const diffMs = scheduledTime.getTime() - currentTime.getTime();
  const secondsLeft = diffMs > 0 ? Math.floor(diffMs / 1000) : 0;

  // Es hoy la carrera? (Zona Horaria Uruguay America/Montevideo)
  const getIsSameDay = () => {
    try {
      const formatter = new Intl.DateTimeFormat("en-US", {
        timeZone: "America/Montevideo",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      });
      const parts = formatter.formatToParts(currentTime);
      const getVal = (type: string) =>
        parts.find((p) => p.type === type)?.value || "";
      const localTodayStr = `${getVal("year")}-${getVal("month")}-${getVal("day")}`;
      return localTodayStr === compDateStr;
    } catch {
      return false;
    }
  };

  const sameDay = getIsSameDay();
  const pastTime = diffMs <= 0;

  // Habilitado si es el mismo día y ya pasó la hora programada (07:00 AM)
  // o si es un día posterior (por tolerancia ante retrasos)
  const isDateBefore = !sameDay && secondsLeft > 0;
  const canStart = comp.status === "PLANNED" && !!officialStartTime;

  const formatCountdown = (totalSeconds: number) => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    return [
      String(hours).padStart(2, "0"),
      String(minutes).padStart(2, "0"),
      String(seconds).padStart(2, "0"),
    ].join(":");
  };

  const handleStart = async (forceWd: boolean = false) => {
    if (!canStart || isStarting) return;

    setIsStarting(true);
    setStartError(null);

    try {
      // Parse to Uruguay timezone -03:00 ISO string
      let formattedStartTime: string | undefined = undefined;
      if (officialStartTime) {
        formattedStartTime = new Date(
          `${officialStartTime}-03:00`,
        ).toISOString();
      }

      // LLAMADA OFICIAL AL BACKEND (Seguridad y Transaccionalidad FEU)
      await CompetitionService.start(
        comp.id,
        formattedStartTime,
        forceWd ? true : undefined,
      );

      // Sincronizar UI con React-Query e invalidar el caché
      queryClient.invalidateQueries({ queryKey: ["competition", comp.id] });
      setPendingConfirmWd(false);
      setMissingCompetitors([]);
      router.refresh();
    } catch (err: any) {
      console.error("[START ERROR]", err);
      const details = err.details;
      if (details && details.message === "LARGADA_PENDIENTE_CONFIRMACION") {
        setPendingConfirmWd(true);
        setMissingCompetitors(details.missingCompetitors || []);
      } else {
        setStartError(err.message || "Error al iniciar la carrera.");
      }
    } finally {
      setIsStarting(false);
    }
  };

  // Renderizar feedback visual según el estado operativo
  const renderStatus = () => {
    if (comp.status === "ACTIVE") {
      return (
        <div className="flex items-center space-x-2 text-emerald-400 font-extrabold text-xs uppercase tracking-widest bg-emerald-950/40 border border-emerald-900/50 px-3 py-1.5 rounded-full w-fit">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <span>Carrera en Curso</span>
        </div>
      );
    }

    if (comp.status === "COMPLETED" || comp.status === "OFFICIAL") {
      return (
        <div className="flex items-center space-x-2 text-blue-400 font-extrabold text-xs uppercase tracking-widest bg-blue-950/40 border border-blue-900/50 px-3 py-1.5 rounded-full w-fit">
          <span>Finalizado</span>
        </div>
      );
    }

    if (comp.status !== "PLANNED") {
      return (
        <div className="flex items-center space-x-2 text-slate-400 font-extrabold text-xs uppercase tracking-widest bg-slate-900/40 border border-slate-800 px-3 py-1.5 rounded-full w-fit">
          <span>{comp.status}</span>
        </div>
      );
    }

    if (isDateBefore) {
      return (
        <div className="flex items-center space-x-2 text-amber-400 font-extrabold text-[10px] uppercase tracking-widest bg-amber-950/40 border border-amber-900/50 px-3 py-1.5 rounded-full w-fit">
          <span>Esperando día de carrera</span>
        </div>
      );
    }

    if (secondsLeft > 0) {
      return (
        <div className="flex items-center space-x-2 text-amber-500 font-extrabold text-[10px] uppercase tracking-widest bg-amber-950/40 border border-amber-800 px-3 py-1.5 rounded-full w-fit">
          <span className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-pulse"></span>
          <span>Esperando hora de largada</span>
        </div>
      );
    }

    return (
      <div className="flex items-center space-x-2 text-emerald-400 font-extrabold text-[10px] uppercase tracking-widest bg-emerald-950/40 border border-emerald-900/50 px-3 py-1.5 rounded-full w-fit">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
        </span>
        <span>Carrera Habilitada</span>
      </div>
    );
  };

  return (
    <div className="bg-gradient-to-br from-slate-900 to-slate-950 text-white rounded-2xl border border-slate-850 shadow-xl p-6 space-y-5 flex flex-col relative overflow-hidden">
      {/* Luces de fondo premium */}
      <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none"></div>

      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div className="flex items-center space-x-2">
          <svg
            className="w-5 h-5 text-emerald-400"
            fill="none"
            stroke="currentColor"
            strokeWidth={2.2}
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15.75 5.25v13.5m-7.5-13.5v13.5"
            />
          </svg>
          <h3 className="text-xs font-extrabold tracking-wider uppercase text-slate-300">
            Control de Carrera
          </h3>
        </div>
        {renderStatus()}
      </div>

      {comp.status === "PLANNED" && (
        <div className="space-y-4">
          {/* Si falta para largar el mismo día */}
          {secondsLeft > 0 && !isDateBefore && (
            <div className="bg-slate-950/60 border border-slate-850 p-4 rounded-xl text-center space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">
                Largada Oficial en
              </span>
              <span className="text-2xl font-extrabold font-sans tabular-nums tracking-wider text-amber-500 animate-pulse block">
                {formatCountdown(secondsLeft)}
              </span>
            </div>
          )}

          {/* Configuración de hora de largada */}
          <div className="bg-slate-950/40 border border-slate-800 p-4 rounded-xl space-y-3">
            <label
              htmlFor="official-start-time"
              className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider"
            >
              ⏱️ Configurar Hora Oficial de Largada
            </label>
            <input
              id="official-start-time"
              type="datetime-local"
              value={officialStartTime}
              onChange={(e) => setOfficialStartTime(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700/60 rounded-xl px-4 py-2.5 text-sm font-sans tabular-nums text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
            />
            <p className="text-[10px] text-slate-400 leading-normal">
              Ajuste la hora real si hay retrasos. Conforme al reglamento FEU,
              la largada oficial no puede ser anterior a la programada (
              {comp.startTime || "07:00"} hs).
            </p>
          </div>

          {/* Información del reglamento */}
          <div className="text-[11px] text-slate-400 leading-relaxed space-y-1 bg-slate-950/20 p-3 rounded-lg border border-slate-900">
            <p className="font-semibold text-slate-300">
              Reglamento FEU Art. 15:
            </p>
            <p>
              La largada oficial de la primera etapa está planificada para las{" "}
              <strong className="text-white font-sans tabular-nums">
                {comp.startTime || "07:00:00"} UY
              </strong>{" "}
              del día{" "}
              <strong className="text-white font-sans tabular-nums">{compDateStr}</strong>.
            </p>
            <p className="text-[10px] text-slate-500 italic mt-1">
              La validación se realiza de forma duplicada tanto en Frontend (UX)
              como en Backend (Seguridad).
            </p>
          </div>

          {/* Manejo de Errores del Backend */}
          {startError && (
            <div className="bg-rose-950/40 border border-rose-900/50 p-3 rounded-xl text-xs text-rose-300 font-semibold leading-relaxed">
              ⚠️ {startError}
            </div>
          )}

          {/* Botón de Largada */}
          <button
            onClick={() => handleStart(false)}
            disabled={!canStart || isStarting}
            className={`w-full inline-flex items-center justify-center px-4 py-3 text-center font-bold text-sm rounded-xl transition-all shadow-md ${
              canStart
                ? "bg-emerald-600 hover:bg-emerald-500 hover:scale-[1.01] active:scale-[0.99] text-white shadow-emerald-950/30"
                : "bg-slate-850 text-slate-500 border border-slate-800 cursor-not-allowed"
            }`}
          >
            {isStarting ? (
              <div className="flex items-center space-x-2">
                <svg
                  className="animate-spin h-4 w-4 text-white"
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
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
                <span>Iniciando Competencia...</span>
              </div>
            ) : (
              <span>Iniciar Competencia</span>
            )}
          </button>
        </div>
      )}

      {comp.status === "ACTIVE" && (
        <div className="bg-emerald-950/10 border border-emerald-900/30 p-4 rounded-xl space-y-2">
          <p className="text-xs text-emerald-400 font-bold">
            La competencia se encuentra activa.
          </p>
          <p className="text-[11px] text-slate-400 leading-relaxed font-semibold">
            Todos los binomios inscriptos han sido largados de la Etapa 1 a la
            hora oficial del servidor.
          </p>
        </div>
      )}

      {(comp.status === "COMPLETED" || comp.status === "OFFICIAL") && (
        <div className="bg-blue-950/10 border border-blue-900/30 p-4 rounded-xl space-y-2">
          <p className="text-xs text-blue-400 font-bold">
            La carrera ha concluido.
          </p>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            Se han registrado todos los tiempos de meta y los resultados finales
            se encuentran consolidados.
          </p>
        </div>
      )}

      {pendingConfirmWd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm transition-opacity duration-300">
          <div className="bg-white rounded-2xl max-w-xl w-full overflow-hidden shadow-2xl border border-slate-100 flex flex-col max-h-[85vh] transition-all transform scale-100 duration-300">
            {/* Header */}
            <div className="bg-amber-50 border-b border-amber-100 px-6 py-4 flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <span className="text-amber-500 text-lg">⚠️</span>
                <div className="text-left">
                  <h3 className="text-base font-extrabold text-amber-900">
                    Confirmación de Largada
                  </h3>
                  <p className="text-xs text-amber-700 mt-0.5 font-medium">
                    Hay competidores que no cumplen los requisitos
                    reglamentarios.
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setPendingConfirmWd(false);
                  setMissingCompetitors([]);
                }}
                className="text-amber-600 hover:text-amber-800 transition-colors"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            {/* Body */}
            <div className="px-6 py-5 overflow-y-auto space-y-4 text-sm text-slate-600 flex-1 text-left">
              <p className="font-semibold text-slate-800">
                Los siguientes binomios no están habilitados para largar por
                tener datos incompletos o inhabilitaciones de la FEU:
              </p>

              <div className="divide-y divide-slate-100 border border-slate-150 rounded-xl overflow-hidden bg-slate-50">
                {missingCompetitors.map((item) => (
                  <div key={item.id} className="p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="inline-flex items-center px-2 py-0.5 rounded bg-slate-200 text-slate-800 text-xs font-bold font-sans tabular-nums">
                        Dorsal #{item.bibNumber}
                      </span>
                      <span className="text-xs font-bold text-slate-800">
                        {item.riderName} / {item.horseName}
                      </span>
                    </div>
                    <ul className="list-disc list-inside text-xs text-rose-600 font-bold pl-1 space-y-0.5">
                      {item.reasons.map((reason: string, idx: number) => (
                        <li key={idx}>{reason}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>

              <div className="bg-amber-50/50 border border-amber-100 p-4 rounded-xl space-y-2 text-xs text-amber-800 leading-relaxed font-semibold">
                <p>
                  <strong>¿Cómo desea proceder?</strong>
                </p>
                <p>
                  Si selecciona{" "}
                  <strong className="text-amber-950">
                    "Confirmar y largar"
                  </strong>
                  , todos los binomios inhabilitados listados arriba cambiarán
                  automáticamente a estado{" "}
                  <strong className="text-amber-950">WD (Retirado)</strong> y el
                  resto iniciará la carrera.
                </p>
                <p>
                  Si selecciona{" "}
                  <strong className="text-amber-950">"Cancelar"</strong>, podrá
                  ir a la Start List para ingresar el pesaje/precinto faltante
                  de estos competidores para habilitarlos.
                </p>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end space-x-3 px-6 py-4 border-t border-slate-100 bg-slate-50">
              <button
                type="button"
                onClick={() => {
                  setPendingConfirmWd(false);
                  setMissingCompetitors([]);
                }}
                className="px-4 py-2 text-slate-500 hover:text-slate-700 text-sm font-bold transition-all focus:outline-none"
              >
                Cancelar y corregir
              </button>
              <button
                type="button"
                onClick={() => handleStart(true)}
                disabled={isStarting}
                className="px-5 py-2.5 bg-amber-600 hover:bg-amber-500 text-white font-extrabold text-sm rounded-xl transition-all shadow-md hover:shadow-lg focus:outline-none flex items-center space-x-2"
              >
                {isStarting && (
                  <svg
                    className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
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
                )}
                <span>Confirmar y largar (excluir faltantes)</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
