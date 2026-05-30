"use client";

import React, { use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { CompetitionService } from '@/services/api/competition.service';

export default function CompetitionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const id = resolvedParams.id;
  const router = useRouter();

  // Fetch de la competencia por ID
  const { data: comp, isLoading, error } = useQuery({
    queryKey: ['competition', id],
    queryFn: () => CompetitionService.getById(id),
    enabled: !!id,
    retry: 1,
  });

  // Calcular la distancia total recorrida
  const getDistanceTotal = (stages?: any[]) => {
    if (!stages || stages.length === 0) return '0.00 km';
    const total = stages.reduce((acc, stage) => acc + parseFloat(stage.distanceKm), 0);
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
    const errorMsg = error instanceof Error ? error.message : 'No se pudo encontrar el evento especificado o no cuenta con los permisos necesarios.';
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center p-6 text-center max-w-lg mx-auto">
        <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl text-rose-600 mb-6 shadow-sm">
          <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h3 className="text-xl font-extrabold text-slate-800 tracking-tight mb-2">Evento no Encontrado</h3>
        <p className="text-sm text-slate-500 leading-relaxed mb-6">
          {errorMsg}
        </p>
        <button
          onClick={() => router.push('/competitions')}
          className="inline-flex items-center justify-center px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-bold text-sm rounded-xl transition-all shadow-md"
        >
          Volver al Calendario
        </button>
      </div>
    );
  }

  const displayDate = comp.competitionDate ? comp.competitionDate.substring(0, 10) : '-';

  return (
    <div className="space-y-8">
      {/* 1. BREADCRUMBS Y NAVEGACIÓN */}
      <nav className="flex items-center space-x-2 text-xs font-bold text-slate-400 uppercase tracking-wider">
        <Link href="/competitions" className="hover:text-equus-green transition-colors">
          Calendario
        </Link>
        <svg className="w-3 h-3 text-slate-300" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
        <span className="text-slate-600 truncate max-w-[200px]">{comp.name}</span>
      </nav>

      {/* 2. HEADER CON ENCABEZADO Y BADGES */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between space-y-4 sm:space-y-0 pb-6 border-b border-slate-100">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-extrabold text-slate-800 tracking-tight mr-2">{comp.name}</h1>
            
            {/* Badge de Federado */}
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-extrabold border ${
              comp.isFederated 
                ? 'bg-amber-50 text-amber-700 border-amber-200/50' 
                : 'bg-slate-50 text-slate-500 border-slate-200/50'
            }`}>
              {comp.isFederated ? '🏆 FEU Federado' : 'Evento Social'}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-slate-500">
            {/* Ubicación */}
            <div className="flex items-center space-x-1.5">
              <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span>{comp.location || 'No especificada'}</span>
            </div>

            {/* Fecha */}
            <div className="flex items-center space-x-1.5 font-mono">
              <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span>{displayDate}</span>
            </div>
          </div>
        </div>

        {/* Estado Actual de la Competencia */}
        <div className="flex items-center space-x-3">
          <span className={`inline-flex rounded-xl px-4 py-2 text-xs font-extrabold border shadow-sm ${
            comp.status === 'ACTIVE' 
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
              : comp.status === 'COMPLETED' || comp.status === 'OFFICIAL'
              ? 'bg-blue-50 text-blue-700 border-blue-200'
              : 'bg-amber-50 text-amber-700 border-amber-200'
          }`}>
            {comp.status === 'ACTIVE' ? '🟢 EN CARRERA' : comp.status === 'PLANNED' ? '📅 PLANIFICADO' : `🏁 ${comp.status}`}
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
                <h3 className="text-base font-extrabold text-slate-800">Plan de Carrera y Etapas</h3>
                <p className="text-xs text-slate-400 mt-0.5">Vet Gates reglamentarios configurados para el evento</p>
              </div>
              <span className="text-xs font-extrabold text-slate-900 bg-white border border-slate-200 px-3 py-1.5 rounded-xl font-mono shadow-sm">
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
                          <span className="absolute -left-[35px] top-1 flex items-center justify-center w-6.5 h-6.5 rounded-full bg-white border-2 border-equus-green text-[10px] font-extrabold text-slate-800 font-mono shadow-sm">
                            {stage.stageNumber}
                          </span>

                          <div className="bg-slate-50/70 hover:bg-slate-50 border border-slate-100/50 p-4 rounded-xl transition-all flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                            <div>
                              <h4 className="text-sm font-bold text-slate-800">
                                Etapa {stage.stageNumber} - Vet Gate
                              </h4>
                              <p className="text-xs text-slate-400 mt-0.5">
                                Requerimiento: Recuperación cardíaca a menos de {comp.maxHeartRate || 65} ppm
                              </p>
                            </div>

                            <div className="flex items-center space-x-6">
                              {/* Distancia de la Etapa */}
                              <div>
                                <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Distancia</span>
                                <span className="text-sm font-extrabold text-slate-900 font-mono">{stage.distanceKm} km</span>
                              </div>

                              {/* Neutralización */}
                              <div>
                                <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Neut.</span>
                                <span className="text-sm font-extrabold text-slate-600 font-mono">{stage.neutralizationMinutes} min</span>
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
        </div>

        {/* Columna Derecha: Acciones Rápidas y Reglas */}
        <div className="space-y-8">
          
          {/* Tarjeta de Acceso Rápido a Start List */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-4 flex flex-col">
            <div className="p-3.5 bg-emerald-50 rounded-xl text-equus-green w-fit">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-slate-800">Planilla y Start List</h3>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                Inscribir binomios participantes, registrar precintos oficiales FEU, lastres de báscula y controlar la admisión deportiva.
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
              <h3 className="text-sm font-extrabold text-slate-800">Límites y Reglas Sanitarias</h3>
              <p className="text-xs text-slate-400 mt-0.5">Parámetros aplicados para Vet Check</p>
            </div>

            <div className="divide-y divide-slate-50 text-xs">
              <div className="py-2.5 flex items-center justify-between">
                <span className="text-slate-500 font-medium">Frecuencia Cardíaca Máxima</span>
                <span className="font-extrabold text-slate-800 font-mono">{comp.maxHeartRate || 65} ppm</span>
              </div>
              <div className="py-2.5 flex items-center justify-between">
                <span className="text-slate-500 font-medium">Habilitación de Lastre</span>
                <span className="font-extrabold text-emerald-600 font-mono">85.00 kg (Art. 20)</span>
              </div>
              <div className="py-2.5 flex items-center justify-between">
                <span className="text-slate-500 font-medium">Tipo de Regulación</span>
                <span className="font-extrabold text-slate-800">Reglamento FEU</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
