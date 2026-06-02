"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { useCompetitions, Competition, MOCK_COMPETITIONS } from "../hooks/useCompetitions";

export default function CompetitionFeed() {
  // Consumir gancho useCompetitions con polling en tiempo real a 30s
  const { competitions, error, isLoading, isValidating } = useCompetitions();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedModality, setSelectedModality] = useState<string>("ALL");
  const [isDemoMode, setIsDemoMode] = useState(false);

  // Activación proactiva del fallback ante caída de API o modo demostración habilitado
  const isUsingFallback = useMemo(() => {
    return isDemoMode || !!error || (competitions.length === 0 && !isLoading);
  }, [isDemoMode, error, competitions, isLoading]);

  const activeData = useMemo(() => {
    return isUsingFallback ? MOCK_COMPETITIONS : competitions;
  }, [isUsingFallback, competitions]);

  // Filtrado reactivo multivariable (búsqueda de club/nombre y selector de tipo FEU)
  const filteredCompetitions = useMemo(() => {
    return activeData.filter((comp) => {
      const matchesSearch =
        comp.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        comp.location.toLowerCase().includes(searchQuery.toLowerCase());

      const modality = comp.competitionType?.modality || "CONTROLLED_SPEED";
      const matchesModality = selectedModality === "ALL" || modality === selectedModality;

      return matchesSearch && matchesModality;
    });
  }, [activeData, searchQuery, selectedModality]);

  // CATEGORIZACIÓN JERÁRQUICA OFICIAL:
  // Prioridad A: En Vivo (ACTIVE, PAUSED)
  const liveCompetitions = useMemo(() => {
    return filteredCompetitions.filter((c) => c.status === "ACTIVE" || c.status === "PAUSED");
  }, [filteredCompetitions]);

  // Prioridad B: Planificadas (PLANNED)
  const plannedCompetitions = useMemo(() => {
    return filteredCompetitions.filter((c) => c.status === "PLANNED");
  }, [filteredCompetitions]);

  // Prioridad C: Pasadas (COMPLETED, OFFICIAL, CANCELLED)
  const pastCompetitions = useMemo(() => {
    return filteredCompetitions.filter(
      (c) => c.status === "COMPLETED" || c.status === "OFFICIAL" || c.status === "CANCELLED"
    );
  }, [filteredCompetitions]);

  // Formateador local de fechas en formato uruguayo
  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString("es-UY", {
        weekday: "short",
        day: "numeric",
        month: "short",
        year: "numeric",
      });
    } catch {
      return dateStr;
    }
  };

  const getModalityLabel = (modality?: string) => {
    switch (modality) {
      case "CONTROLLED_SPEED":
        return "Velocidad Controlada (Raid FEU)";
      case "FREE_SPEED":
        return "Velocidad Libre (Endurance)";
      case "FLAT_RACING":
        return "Carrera Plana (Turf)";
      default:
        return "Raid Hípico";
    }
  };

  return (
    <div className="space-y-10">
      
      {/* ========================================================================= */}
      {/* PANEL DE CONTROL / BUSCADOR Y FILTROS TÁCTILES                            */}
      {/* ========================================================================= */}
      <div className="bg-white border border-slate-200/60 p-6 rounded-3xl shadow-sm space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start space-x-3">
            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-800 hidden sm:block">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-900 leading-tight">Portal de Resultados para Espectadores</h2>
              <p className="text-xs text-slate-500 font-bold mt-1">
                Selecciona una competencia activa a continuación para ver clasificaciones, o filtra por club, lugar o modalidad.
              </p>
            </div>
          </div>

          {/* Toggle de Modo Demo con Amplia Zona de Contacto táctil (>44px) */}
          <div className="flex items-center space-x-3 self-end md:self-auto min-h-[44px]">
            <span className="text-xs text-slate-700 font-extrabold">Modo Simulado (Demo):</span>
            <button
              onClick={() => setIsDemoMode(!isDemoMode)}
              aria-label="Alternar modo simulado"
              className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors focus:outline-none shadow-sm cursor-pointer ${
                isUsingFallback ? "bg-equus-green" : "bg-gray-200"
              }`}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform shadow-md ${
                  isUsingFallback ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>
        </div>

        {/* CONTROLES ADAPTATIVOS CON HITBOX MIN DE 44PX (h-11 / py-3) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          
          {/* Input de Búsqueda con Altura Táctil de 44px */}
          <div className="relative">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </span>
            <input
              type="text"
              placeholder="Buscar por Club, Raid o Localidad..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-11 bg-slate-50 text-slate-900 border border-slate-200 pl-10 pr-4 rounded-xl text-sm focus:outline-none focus:border-equus-green focus:bg-white font-semibold transition-all shadow-inner"
            />
          </div>

          {/* Selector de Modalidad (Pestañas con Altura Táctil h-11 de 44px) */}
          <div className="flex space-x-1 bg-slate-100 p-1 rounded-xl h-11">
            {(["ALL", "CONTROLLED_SPEED", "FREE_SPEED"] as const).map((mod) => (
              <button
                key={mod}
                onClick={() => setSelectedModality(mod)}
                className={`flex-1 text-center rounded-lg text-xs font-black transition-all cursor-pointer ${
                  selectedModality === mod
                    ? "bg-white text-slate-950 shadow-sm"
                    : "text-slate-500 hover:text-slate-900"
                }`}
              >
                {mod === "ALL" ? "Todos" : mod === "CONTROLLED_SPEED" ? "Raid" : "Endurance"}
              </button>
            ))}
          </div>

          {/* Estado de Sincronización de API */}
          <div className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-xl px-4 h-11 text-xs">
            <span className="text-slate-500 font-bold">Estado Red:</span>
            <div className="flex items-center space-x-2">
              {isLoading && !isUsingFallback ? (
                <span className="flex items-center text-amber-600 font-extrabold space-x-1.5 animate-pulse">
                  <span className="h-2 w-2 rounded-full bg-amber-500"></span>
                  <span>Cargando...</span>
                </span>
              ) : error ? (
                <span className="flex items-center text-rose-600 font-extrabold space-x-1.5">
                  <span className="h-2 w-2 rounded-full bg-rose-500 animate-ping"></span>
                  <span>Sin Conexión</span>
                </span>
              ) : isDemoMode ? (
                <span className="flex items-center text-[#AD8F6C] font-extrabold space-x-1.5">
                  <span className="h-2 w-2 rounded-full bg-[#A99677] animate-pulse"></span>
                  <span>Modo Demostración</span>
                </span>
              ) : (
                <span className="flex items-center text-emerald-600 font-extrabold space-x-1.5">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  <span>Actualizado</span>
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SKELETON LOADER DUAL (EVITA saltos CLS en teléfonos móviles)               */}
      {/* ========================================================================= */}
      {isLoading && !isUsingFallback && (
        <div className="space-y-6">
          <div className="h-6 bg-slate-200 w-1/4 rounded animate-pulse"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-pulse">
            {[1, 2].map((i) => (
              <div key={i} className="bg-white border border-slate-200 rounded-3xl p-6 space-y-4">
                <div className="flex justify-between items-center">
                  <div className="h-6 bg-slate-200 w-1/3 rounded"></div>
                  <div className="h-6 bg-slate-200 w-16 rounded-full"></div>
                </div>
                <div className="h-5 bg-slate-200 w-2/3 rounded"></div>
                <div className="h-4 bg-slate-100 w-1/2 rounded"></div>
                <div className="h-11 bg-slate-200 w-full rounded-xl"></div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* RENDERIZADO DEL CONTENIDO FILTRADO Y JERARQUIZADO                         */}
      {/* ========================================================================= */}
      {(!isLoading || isUsingFallback) && (
        <div className="space-y-12">
          
          {/* ========================================================================= */}
          {/* PRIORIDAD A: EN VIVO (ACTIVE, PAUSED)                                     */}
          {/* ========================================================================= */}
          <div>
            <div className="flex items-center space-x-3 mb-6 border-b border-slate-200/60 pb-3">
              <span className="relative flex h-3.5 w-3.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500"></span>
              </span>
              <h3 className="text-base font-black text-slate-900 tracking-tight uppercase">
                Competencias en Vivo
              </h3>
              <span className="bg-emerald-50 text-emerald-950 text-[10px] font-black px-2.5 py-1 rounded-full border border-emerald-300">
                {liveCompetitions.length} Evento(s)
              </span>
            </div>

            {liveCompetitions.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {liveCompetitions.map((comp) => (
                  <div
                    key={comp.id}
                    className="relative bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 text-white rounded-3xl p-6 shadow-xl border border-emerald-500/20 overflow-hidden group hover:shadow-2xl hover:border-emerald-500/50 transition-all duration-300"
                  >
                    {/* Destello decorativo de fondo */}
                    <div className="absolute -top-10 -right-10 w-40 h-40 bg-emerald-500/10 rounded-full blur-2xl group-hover:bg-emerald-500/20 transition-all" />

                    <div className="flex justify-between items-start">
                      <span className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-black tracking-widest bg-emerald-500 text-slate-950 uppercase border border-emerald-400 animate-pulse">
                        <span className="h-1.5 w-1.5 rounded-full bg-slate-950 mr-1.5"></span>
                        EN VIVO
                      </span>
                      {comp.isFederated && (
                        <span className="text-[10px] font-black text-equus-tan-light tracking-wider bg-white/5 border border-white/10 px-2 py-0.5 rounded-md">
                          FEDERADO
                        </span>
                      )}
                    </div>

                    <div className="mt-4">
                      <h4 className="text-xl font-extrabold text-white tracking-tight leading-tight group-hover:text-emerald-400 transition-colors">
                        {comp.name}
                      </h4>
                      <p className="text-slate-300 text-xs mt-1.5 font-bold flex items-center">
                        <svg className="h-4 w-4 mr-1 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        </svg>
                        {comp.location}
                      </p>
                    </div>

                    <div className="mt-6 pt-4 border-t border-white/5 grid grid-cols-2 gap-4 text-xs">
                      <div>
                        <span className="text-slate-400 block uppercase tracking-wider text-[9px] font-bold">Modalidad</span>
                        <span className="font-extrabold text-slate-200 mt-0.5 block">
                          {getModalityLabel(comp.competitionType?.modality)}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block uppercase tracking-wider text-[9px] font-bold">Distancia</span>
                        <span className="font-extrabold text-slate-200 mt-0.5 block">
                          {comp.stages?.length || 0} Etapas ({comp.stages?.reduce((acc, curr) => acc + curr.distanceKm, 0) || 0} Km)
                        </span>
                      </div>
                    </div>

                    {/* Botón táctil destacado con hitbox de 48px de alto (h-12) */}
                    <div className="mt-6">
                      <Link
                        href={`/leaderboard/${comp.id}`}
                        className="w-full h-12 flex items-center justify-center space-x-2 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-black text-sm rounded-2xl shadow-lg hover:shadow-emerald-500/20 transition-all cursor-pointer"
                      >
                        <span>Ver Tabla de Clasificaciones</span>
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                        </svg>
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-slate-50 border border-slate-200 rounded-3xl p-8 text-center text-slate-500">
                <svg className="h-10 w-10 mx-auto text-slate-400 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364.364l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 113.536 0V21h2v-2.243a4.978 4.978 0 011.07-.19M12 13V9" />
                </svg>
                <p className="text-sm font-bold text-slate-800">No hay competencias activas en este momento.</p>
                <p className="text-xs text-slate-500 mt-1.5 font-semibold">
                  Activa el "Modo Simulado" arriba en el panel para ver la simulación del Raid Batalla de Tupambaé.
                </p>
              </div>
            )}
          </div>

          {/* ========================================================================= */}
          {/* PRIORIDAD B: PLANIFICADAS (PLANNED)                                       */}
          {/* ========================================================================= */}
          <div>
            <div className="flex items-center space-x-3 mb-6 border-b border-slate-200 pb-3">
              <h3 className="text-base font-black text-slate-800 tracking-tight uppercase">
                Próximos Eventos Planificados
              </h3>
              <span className="bg-slate-100 text-slate-800 text-[10px] font-black px-2.5 py-1 rounded-full border border-slate-200">
                {plannedCompetitions.length} Evento(s)
              </span>
            </div>

            {plannedCompetitions.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {plannedCompetitions.map((comp) => (
                  <div
                    key={comp.id}
                    className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200/60 flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex justify-between items-start">
                        <span className="bg-amber-50 text-amber-950 text-[10px] font-black px-2.5 py-1 rounded-full border border-amber-200 block uppercase">
                          Planificado
                        </span>
                        <span className="text-[10px] font-extrabold text-slate-600 font-mono">
                          {formatDate(comp.competitionDate)}
                        </span>
                      </div>

                      <div className="mt-4">
                        <h4 className="text-base font-extrabold text-slate-900 leading-tight">
                          {comp.name}
                        </h4>
                        <p className="text-slate-500 text-xs mt-1.5 font-bold flex items-center">
                          <svg className="h-3.5 w-3.5 mr-1 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                          </svg>
                          {comp.location}
                        </p>
                      </div>
                    </div>

                    <div className="mt-6 pt-4 border-t border-slate-100 space-y-2 text-xs">
                      <div className="flex justify-between">
                        <span className="text-slate-400 font-bold">Modalidad:</span>
                        <span className="font-extrabold text-slate-700">
                          {comp.competitionType?.name || "Raid Hípico"}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400 font-bold">Distancia Total:</span>
                        <span className="font-extrabold text-slate-700">
                          {comp.stages?.reduce((acc, curr) => acc + curr.distanceKm, 0) || 0} Km ({comp.stages?.length || 0} Etapas)
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400 font-bold">Club Organizador:</span>
                        <span className="font-extrabold text-slate-700">
                          {comp.tenant?.name || "Club Oficial"}
                        </span>
                      </div>
                    </div>

                    {/* Badge informativo de no disponibilidad de tiempos */}
                    <div className="mt-6 bg-slate-50 text-slate-500 rounded-2xl p-3 text-[10px] text-center font-bold border border-slate-150">
                      Datos en vivo disponibles el día del evento
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-white border border-slate-200/60 rounded-3xl p-8 text-center text-slate-400 text-sm font-semibold">
                No hay competencias planificadas registradas.
              </div>
            )}
          </div>

          {/* ========================================================================= */}
          {/* PRIORIDAD C: HISTÓRICOS (COMPLETED, OFFICIAL, CANCELLED)                  */}
          {/* Optimización de Responsividad: Render de tarjetas en móvil y tabla en PC  */}
          {/* ========================================================================= */}
          <div>
            <div className="flex items-center space-x-3 mb-6 border-b border-slate-200 pb-3">
              <h3 className="text-base font-black text-slate-800 tracking-tight uppercase">
                Historial de Resultados Consolidados
              </h3>
              <span className="bg-slate-100 text-slate-800 text-[10px] font-black px-2.5 py-1 rounded-full border border-slate-200">
                {pastCompetitions.length} Evento(s)
              </span>
            </div>

            {pastCompetitions.length > 0 ? (
              <div className="space-y-4">
                
                {/* 1. MÓVIL (TARJETAS HISTÓRICAS) */}
                <div className="block md:hidden space-y-4">
                  {pastCompetitions.map((comp) => {
                    const isOfficial = comp.status === "OFFICIAL";
                    const isCancelled = comp.status === "CANCELLED";
                    const statusColors = isCancelled
                      ? "bg-rose-50 text-rose-950 border-rose-200"
                      : isOfficial
                      ? "bg-green-50 text-green-950 border-green-200"
                      : "bg-slate-50 text-slate-900 border-slate-200";

                    const statusLabel = isCancelled
                      ? "Cancelado"
                      : isOfficial
                      ? "Oficial (FEU Auditado)"
                      : "Finalizado";

                    return (
                      <div
                        key={comp.id}
                        className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm space-y-4"
                      >
                        <div className="flex justify-between items-start">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-black border ${statusColors}`}>
                            {statusLabel}
                          </span>
                          <span className="text-[10px] font-bold text-slate-500 font-mono">
                            {formatDate(comp.competitionDate)}
                          </span>
                        </div>

                        <div>
                          <h4 className="font-extrabold text-slate-900 text-base">{comp.name}</h4>
                          <p className="text-xs text-slate-500 font-bold mt-0.5">{comp.tenant?.name || "Organización FEU"}</p>
                        </div>

                        <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-100 text-xs font-bold">
                          <div>
                            <span className="text-slate-400 block text-[9px] uppercase tracking-wider">Ubicación</span>
                            <span className="text-slate-800 font-extrabold">{comp.location}</span>
                          </div>
                          <div>
                            <span className="text-slate-400 block text-[9px] uppercase tracking-wider">Distancia Total</span>
                            <span className="text-slate-800 font-extrabold">
                              {comp.stages?.reduce((acc, curr) => acc + curr.distanceKm, 0) || 0} Km
                            </span>
                          </div>
                        </div>

                        <div className="pt-2 border-t border-slate-100">
                          {isCancelled ? (
                            <div className="w-full bg-slate-50 text-slate-400 text-xs font-bold py-3.5 rounded-2xl text-center border border-slate-100">
                              Sin Resultados por Cancelación
                            </div>
                          ) : (
                            <Link
                              href={`/leaderboard/${comp.id}`}
                              className="w-full h-11 flex items-center justify-center space-x-2 bg-slate-100 hover:bg-slate-200 text-slate-950 font-black text-xs rounded-2xl border border-slate-200 transition-all cursor-pointer"
                            >
                              <span>Ver Clasificación Histórica</span>
                              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                              </svg>
                            </Link>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* 2. ESCRITORIO (TABLA HISTÓRICA) */}
                <div className="hidden md:block bg-white border border-slate-200/60 rounded-3xl overflow-hidden shadow-sm">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-150 text-slate-500 text-xs font-bold uppercase tracking-wider">
                          <th className="py-4.5 px-6">Raid / Club Organizador</th>
                          <th className="py-4.5 px-6">Fecha</th>
                          <th className="py-4.5 px-6">Ubicación</th>
                          <th className="py-4.5 px-6">Distancia</th>
                          <th className="py-4.5 px-6 text-center">Estado</th>
                          <th className="py-4.5 px-6 text-right">Acciones</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-150 text-sm text-slate-700">
                        {pastCompetitions.map((comp) => {
                          const isOfficial = comp.status === "OFFICIAL";
                          const isCancelled = comp.status === "CANCELLED";
                          const statusColors = isCancelled
                            ? "bg-rose-50 text-rose-950 border-rose-200"
                            : isOfficial
                            ? "bg-green-50 text-green-950 border-green-200"
                            : "bg-slate-50 text-slate-900 border-slate-200";

                          const statusLabel = isCancelled
                            ? "Cancelado"
                            : isOfficial
                            ? "Oficial (FEU Auditado)"
                            : "Finalizado";

                          return (
                            <tr key={comp.id} className="hover:bg-slate-50/50 transition-colors">
                              {/* RAID / CLUB */}
                              <td className="py-4 px-6">
                                <div className="font-extrabold text-slate-900">{comp.name}</div>
                                <div className="text-xs text-slate-500 font-bold mt-0.5">
                                  {comp.tenant?.name || "Organización FEU"}
                                </div>
                              </td>

                              {/* FECHA */}
                              <td className="py-4 px-6 text-slate-600 font-bold">
                                {formatDate(comp.competitionDate)}
                              </td>

                              {/* UBICACIÓN */}
                              <td className="py-4 px-6 text-slate-500 text-xs font-bold">
                                {comp.location}
                              </td>

                              {/* DISTANCIA */}
                              <td className="py-4 px-6 text-slate-700 font-black">
                                {comp.stages?.reduce((acc, curr) => acc + curr.distanceKm, 0) || 0} Km
                              </td>

                              {/* ESTADO */}
                              <td className="py-4 px-6 text-center">
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border ${statusColors}`}>
                                  {statusLabel}
                                </span>
                              </td>

                              {/* ACCIÓN (Hitbox táctil > 44px) */}
                              <td className="py-4 px-6 text-right">
                                {isCancelled ? (
                                  <span className="text-xs text-slate-400 font-bold px-3">Sin Clasificación</span>
                                ) : (
                                  <Link
                                    href={`/leaderboard/${comp.id}`}
                                    className="inline-flex items-center justify-center h-10 px-4 bg-slate-100 hover:bg-equus-green hover:text-white text-slate-800 text-xs font-black rounded-xl border border-slate-200 hover:border-equus-green transition-all cursor-pointer"
                                  >
                                    <span>Ver Tiempos</span>
                                    <svg className="h-3.5 w-3.5 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                                    </svg>
                                  </Link>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

              </div>
            ) : (
              <div className="bg-white border border-slate-200/50 rounded-3xl p-8 text-center text-slate-400 font-semibold text-sm">
                No hay registros de competencias anteriores.
              </div>
            )}
          </div>

        </div>
      )}

    </div>
  );
}
