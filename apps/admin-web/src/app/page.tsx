"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { DashboardService } from "@/services/api/dashboard.service";
import { useAuthStore } from "@/store/auth.store";

export default function Home() {
  const user = useAuthStore((state) => state.user);
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Consumo en tiempo real del nuevo endpoint de estadísticas mediante useQuery
  const {
    data: statsData,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: () => DashboardService.getStats(),
    refetchInterval: 12000, // Auto-actualización cada 12 segundos para feeling operativo
  });

  const getBadgeStyle = (type: string) => {
    switch (type) {
      case "warning":
        return "bg-rose-50 text-rose-700 border border-rose-100/50";
      case "success":
        return "bg-emerald-50 text-emerald-700 border border-emerald-100/50";
      case "accent":
        return "bg-amber-50 text-amber-700 border border-amber-200/50";
      default:
        return "bg-slate-50 text-slate-500 border border-slate-200/50";
    }
  };

  // Definición de las tarjetas de estadísticas principales
  const stats = [
    {
      name: "Caballos en Padrón",
      value: statsData?.totalHorses.toString() || "0",
      change: `${statsData?.expiredHealthHorses || 0} con sanidad vencida`,
      changeType:
        (statsData?.expiredHealthHorses || 0) > 0 ? "warning" : "neutral",
    },
    {
      name: "Jinetes Federados",
      value: statsData?.totalRiders.toString() || "0",
      change: `${statsData?.activeRiders || 0} habilitados FEU`,
      changeType: "success",
    },
    {
      name: "Propietarios / Haras",
      value: statsData?.totalOwners.toString() || "0",
      change: "Registros activos",
      changeType: "neutral",
    },
    {
      name: "Próximas Competencias",
      value: statsData?.activeCompetition
        ? "1 ACTIVA"
        : statsData?.upcomingCompetitions
            ?.filter((c) => c.status === "PLANNED")
            .length.toString() || "0",
      change: statsData?.activeCompetition
        ? "Carrera en curso"
        : "Fase planificación",
      changeType: statsData?.activeCompetition ? "warning" : "accent",
    },
  ];

  const quickLinks = [
    {
      title: "Padrón de Caballos",
      description:
        "Gestiona la trazabilidad, chips RFID, y vencimientos de sanidad MGAP para competencias.",
      href: "/horses",
      icon: (
        <svg
          className="h-6 w-6 text-equus-green"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M17 11c.3-3-1.5-5.5-3.8-6.5C10.5 3.5 7.5 5.5 7.5 8c0 .5-.1 1-.3 1.5L5 12.5c-.3.5-.1 1.2.4 1.5l1.6 1c.5.3 1.1.2 1.5-.2l.7-.7c.3-.3.8-.4 1.2-.2l1.6.8c1 .5 2.2.4 3.1-.3l2.4-1.9c.4-.3.5-.8.3-1.2L17 11z"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9.5 20h6M8.5 16h8"
          />
          <circle cx="12" cy="7.5" r="0.75" fill="currentColor" />
        </svg>
      ),
      color: "green",
    },
    {
      title: "Padrón de Propietarios",
      description:
        "Control de Haras, Studs y criadores oficiales habilitados por la federación.",
      href: "/owners",
      icon: (
        <svg
          className="h-6 w-6 text-slate-600"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
          />
        </svg>
      ),
      color: "tan",
    },
    {
      title: "Calendario y Etapas",
      description:
        "Visualiza distancias, neutralizaciones en Vet Gates, y control de cronometraje.",
      href: "/competitions",
      icon: (
        <svg
          className="h-6 w-6 text-slate-700"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        </svg>
      ),
      color: "slate",
    },
  ];

  return (
    <div className="space-y-8">
      {/* Saludo Principal Corporativo */}
      <div className="bg-gradient-to-br from-equus-green to-emerald-950 rounded-2xl p-6 md:p-8 text-white shadow-xl border border-white/5 relative overflow-hidden">
        <div className="absolute top-0 right-0 -mt-6 -mr-6 w-32 h-32 bg-white/5 rounded-full blur-2xl pointer-events-none"></div>
        <div className="max-w-3xl relative z-10">
          <div className="mb-3 flex items-center space-x-2">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span className="text-xs font-bold text-slate-300 tracking-wider uppercase">
              BASE DE DATOS OPERATIVA
            </span>
          </div>
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight">
            ¡Hola, {isMounted && user ? user.name : "Administrador"}!
          </h2>
          <p className="mt-2 text-slate-200 text-sm md:text-base leading-relaxed font-medium">
            Bienvenido al panel maestro de <span className="font-extrabold text-white">EquusCronos</span>. Desde aquí puedes
            controlar la gobernanza deportiva del club, administrar binomios,
            fiscalizar inspecciones veterinarias en Vet Gates, y asegurar el
            cumplimiento de normativas sanitarias vigentes.
          </p>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl text-rose-700 text-sm font-semibold flex items-center space-x-2">
          <svg
            className="w-5 h-5 flex-shrink-0"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
          <span>
            Error al sincronizar estadísticas en vivo:{" "}
            {(error as any).message || String(error)}
          </span>
        </div>
      )}

      {/* Grid de Estadísticas con Skeletons Animados */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((item, idx) => {
          if (isLoading) {
            return (
              <div
                key={`skeleton-stat-${idx}`}
                className="bg-white overflow-hidden shadow-sm rounded-2xl border border-slate-100 p-5 flex flex-col justify-between h-28"
              >
                <div className="flex items-start justify-between">
                  <div className="h-3 w-24 bg-slate-100 animate-pulse rounded-full"></div>
                  <div className="h-5 w-20 bg-slate-100 animate-pulse rounded-full"></div>
                </div>
                <div className="mt-4 h-8 w-16 bg-slate-100 animate-pulse rounded-lg"></div>
              </div>
            );
          }

          const isHighlight =
            item.name === "Próximas Competencias" &&
            statsData?.activeCompetition;

          return (
            <div
              key={item.name}
              className={`overflow-hidden shadow-sm rounded-2xl border p-5 transition-all duration-200 flex flex-col justify-between ${
                isHighlight
                  ? "bg-rose-50/30 border-rose-200 shadow-md shadow-rose-100/40 relative"
                  : "bg-white border-slate-100 hover:shadow-md hover:border-slate-200/60"
              }`}
            >
              {isHighlight && (
                <span className="absolute top-0 right-0 h-2 w-2 rounded-full bg-rose-500 animate-ping mt-5 mr-5" />
              )}
              <div className="flex items-start justify-between gap-2">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider whitespace-normal leading-4">
                  {item.name}
                </span>
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold whitespace-nowrap ${getBadgeStyle(item.changeType)}`}
                >
                  {item.change}
                </span>
              </div>

              <div className="mt-4 flex items-baseline justify-between">
                <span
                  className={`text-3xl font-extrabold tracking-tight ${isHighlight ? "text-rose-600" : "text-slate-950"}`}
                >
                  {item.value}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Bloque Operativo Central */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Enlaces de Acción Rápida */}
        <div className="lg:col-span-2 space-y-6">
          {/* Tarjeta de Próximas Competencias / ACTIVE Highlight Card */}
          <div className="space-y-4">
            <h3 className="text-base font-bold text-slate-800 uppercase tracking-wider">
              Estado de Competencia
            </h3>

            {isLoading ? (
              <div className="h-44 bg-white border border-slate-100 rounded-2xl animate-pulse p-6 flex flex-col justify-between">
                <div className="space-y-3">
                  <div className="h-4 w-32 bg-slate-100 rounded-full"></div>
                  <div className="h-6 w-3/4 bg-slate-100 rounded-lg"></div>
                  <div className="h-4.5 w-1/2 bg-slate-100 rounded-md"></div>
                </div>
                <div className="h-10 w-full bg-slate-100 rounded-xl"></div>
              </div>
            ) : statsData?.activeCompetition ? (
              // WIDGET OPERATIVO RESALTADO - COMPETENCIA ACTIVE
              <div className="bg-gradient-to-tr from-slate-900 via-emerald-950 to-slate-900 rounded-3xl p-6 text-white shadow-xl border border-emerald-500/20 relative overflow-hidden animate-pulse-once group">
                <div className="absolute top-0 right-0 -mt-8 -mr-8 w-40 h-40 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none group-hover:bg-emerald-500/25 transition-colors duration-300"></div>
                <div className="relative z-10 flex flex-col justify-between h-full space-y-6">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="flex h-2.5 w-2.5 relative">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500"></span>
                        </span>
                        <span className="text-[10px] font-extrabold uppercase text-rose-400 tracking-wider">
                          Carrera en Curso (Activa)
                        </span>
                      </div>
                      <h4 className="text-xl font-black mt-2 text-white leading-tight">
                        {statsData.activeCompetition.name}
                      </h4>
                      <p className="text-xs text-slate-300 font-medium mt-1">
                        📍{" "}
                        {statsData.activeCompetition.location ||
                          "Melo, Cerro Largo"}{" "}
                        • 📅 {statsData.activeCompetition.competitionDate}
                      </p>
                    </div>

                    <div className="bg-white/10 border border-white/20 rounded-2xl px-4 py-2 text-center sm:text-right">
                      <span className="block text-[8px] text-slate-400 font-bold uppercase tracking-wider">
                        Límite Vet Gate
                      </span>
                      <span className="block text-lg font-black text-emerald-400 font-sans tabular-nums mt-0.5">
                        {statsData.activeCompetition.maxHeartRate || 65} ppm
                      </span>
                    </div>
                  </div>

                  <div className="border-t border-white/10 pt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <p className="text-xs text-slate-300 leading-relaxed max-w-md">
                      El cronómetro oficial y las estaciones de control
                      veterinario se encuentran operativas en tiempo real.
                      Habilite binomios e ingrese al motor de cronometraje.
                    </p>

                    <Link
                      href={`/competitions/${statsData.activeCompetition.id}/start-list`}
                      className="inline-flex items-center justify-center px-5 py-3 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-white font-extrabold text-xs rounded-xl shadow-lg hover:shadow-emerald-950/20 transition-all uppercase tracking-wider whitespace-nowrap self-stretch sm:self-auto"
                    >
                      Ingresar al Motor de Carrera
                      <svg
                        className="ml-2 h-4 w-4 transform group-hover:translate-x-1 transition-transform"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2.5}
                          d="M13 5l7 7-7 7M5 5l7 7-7 7"
                        />
                      </svg>
                    </Link>
                  </div>
                </div>
              </div>
            ) : (
              // CALENDARIO PLANIFICADO / NO HAY COMPETENCIA ACTIVA
              <div className="bg-white border border-slate-100 rounded-3xl p-5 shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b border-slate-50 pb-3">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                    Calendario de Eventos
                  </span>
                  <Link
                    href="/competitions"
                    className="text-xs font-bold text-equus-green hover:underline"
                  >
                    Ver todos
                  </Link>
                </div>

                {statsData?.upcomingCompetitions &&
                statsData.upcomingCompetitions.length > 0 ? (
                  <div className="divide-y divide-slate-50">
                    {statsData.upcomingCompetitions.slice(0, 3).map((comp) => (
                      <div
                        key={comp.id}
                        className="py-3 flex items-center justify-between gap-4 group"
                      >
                        <div>
                          <h5 className="text-sm font-bold text-slate-800 group-hover:text-equus-green transition-colors">
                            {comp.name}
                          </h5>
                          <span className="text-[10px] text-slate-400 font-medium">
                            {comp.location || "Cerro Largo"} •{" "}
                            {comp.competitionDate}
                          </span>
                        </div>
                        <Link
                          href={`/competitions/${comp.id}/start-list`}
                          className="px-3 py-1 bg-slate-50 border border-slate-200/50 hover:bg-slate-100 text-[10px] font-bold text-slate-600 rounded-lg transition-colors"
                        >
                          Ver Ficha
                        </Link>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-6 text-xs text-slate-400">
                    No hay próximas competencias planificadas.
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="space-y-4">
            <h3 className="text-base font-bold text-slate-800 uppercase tracking-wider">
              Accesos Directos
            </h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {quickLinks.map((item) => {
                const hoverColorClass =
                  item.color === "green"
                    ? "hover:border-emerald-100 hover:bg-emerald-50/10"
                    : item.color === "tan"
                      ? "hover:border-amber-100 hover:bg-amber-50/10"
                      : "hover:border-slate-200 hover:bg-slate-50/10";

                const titleColorClass =
                  item.color === "green"
                    ? "group-hover:text-equus-green"
                    : item.color === "tan"
                      ? "group-hover:text-amber-800"
                      : "group-hover:text-slate-800";

                return (
                  <Link
                    key={item.title}
                    href={item.href}
                    className={`group p-5 bg-white rounded-2xl border border-slate-100 ${hoverColorClass} hover:shadow-md transition-all duration-250 flex flex-col justify-between`}
                  >
                    <div>
                      <div className="p-2 w-fit rounded-xl bg-slate-50 group-hover:bg-white transition-colors">
                        {item.icon}
                      </div>
                      <h4
                        className={`mt-4 text-base font-bold text-slate-950 ${titleColorClass} transition-colors`}
                      >
                        {item.title}
                      </h4>
                      <p className="mt-1.5 text-xs text-slate-500 leading-relaxed">
                        {item.description}
                      </p>
                    </div>
                    <div className="mt-5 flex items-center text-xs font-bold text-slate-600 group-hover:text-slate-800 transition-colors">
                      Ingresar
                      <svg
                        className="ml-1.5 h-4 w-4 transform group-hover:translate-x-1 transition-transform"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 5l7 7-7 7"
                        />
                      </svg>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>

        {/* Novedades / Alertas Sanitarias Destacadas */}
        <div className="space-y-4">
          <h3 className="text-base font-bold text-slate-800 uppercase tracking-wider">
            Alertas Sanitarias
          </h3>

          {isLoading ? (
            <div className="bg-white rounded-2xl border border-slate-100 p-5 space-y-4 shadow-sm animate-pulse">
              <div className="h-16 bg-slate-50 rounded-xl"></div>
              <div className="space-y-3">
                <div className="h-4 w-1/3 bg-slate-100 rounded"></div>
                <div className="h-12 bg-slate-50 rounded-xl"></div>
                <div className="h-12 bg-slate-50 rounded-xl"></div>
                <div className="h-12 bg-slate-50 rounded-xl"></div>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-100 p-5 space-y-4 shadow-sm">
              {/* Alerta Roja/Amber Destacada de Acción Inmediata */}
              <div className="flex items-start space-x-3.5 p-4 rounded-xl bg-rose-50/50 border border-rose-100 shadow-sm relative overflow-hidden group hover:bg-rose-50 transition-colors duration-200">
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-rose-500"></div>
                <svg
                  className="h-5 w-5 text-rose-600 flex-shrink-0 mt-0.5 animate-pulse"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
                <div>
                  <h4 className="text-xs font-bold text-rose-900 uppercase tracking-wider">
                    Control MGAP: Alerta
                  </h4>
                  <p className="text-[11px] text-rose-700 leading-relaxed mt-1 font-medium">
                    {(statsData?.expiredHealthHorses || 0) > 0 ? (
                      <span>
                        ¡Atención! Hay **{statsData?.expiredHealthHorses}{" "}
                        caballos** con vencimientos de sanidad expirada en el
                        padrón nacional.
                      </span>
                    ) : (
                      <span>
                        Todos los equinos registrados en el padrón cuentan con
                        controles de sanidad y anemia al día.
                      </span>
                    )}
                  </p>
                </div>
              </div>

              {/* LISTA INTERACTIVA: CABALLOS PRÓXIMOS A VENCER */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest border-b border-slate-50 pb-2">
                  Sanidad Próxima a Vencer
                </h4>

                {statsData?.expiringHorses &&
                statsData.expiringHorses.length > 0 ? (
                  <div className="space-y-2">
                    {statsData.expiringHorses.map((horse) => {
                      const isExpired =
                        horse.healthRecordsExpiration &&
                        new Date(horse.healthRecordsExpiration) < new Date();

                      return (
                        <Link
                          key={horse.id}
                          href={`/admin/horses/${horse.id}`}
                          className="flex items-center justify-between p-3 rounded-xl border border-slate-100 hover:border-equus-green hover:bg-slate-50/50 transition-all group"
                        >
                          <div className="flex items-center space-x-3">
                            {horse.imageUrl ? (
                              <img
                                src={horse.imageUrl}
                                alt={horse.name}
                                className="h-8 w-8 rounded-full object-cover border border-slate-200 shadow-sm"
                              />
                            ) : (
                              <div className="h-8 w-8 rounded-full bg-gradient-to-br from-amber-700 to-amber-950 text-white font-bold flex items-center justify-center text-[10px]">
                                {horse.name
                                  .split(" ")
                                  .map((n) => n[0])
                                  .join("")
                                  .substring(0, 2)
                                  .toUpperCase()}
                              </div>
                            )}
                            <div>
                              <span className="text-xs font-bold text-slate-800 group-hover:text-equus-green transition-colors block">
                                {horse.name}
                              </span>
                              {horse.chipId ? (
                                <span className="text-[9px] text-slate-400 font-sans tabular-nums font-semibold">
                                  RFID: {horse.chipId}
                                </span>
                              ) : (
                                <span className="text-[9px] text-slate-300 italic font-semibold">
                                  Sin chip RFID
                                </span>
                              )}
                            </div>
                          </div>

                          <span
                            className={`inline-flex items-center text-[9px] font-bold px-2 py-0.5 rounded ${
                              isExpired
                                ? "bg-rose-50 text-rose-700 border border-rose-200"
                                : "bg-amber-50 text-amber-700 border border-amber-200/50"
                            }`}
                          >
                            {horse.healthRecordsExpiration
                              ? horse.healthRecordsExpiration.substring(0, 10)
                              : "-"}
                          </span>
                        </Link>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic text-center py-4">
                    No se registran vencimientos de sanidad activos.
                  </p>
                )}
              </div>

              {/* Sincronización FEU Activa */}
              <div className="flex items-start space-x-3.5 p-4 rounded-xl bg-emerald-50/30 border border-emerald-100 hover:bg-emerald-50/60 transition-colors duration-200">
                <svg
                  className="h-5 w-5 text-emerald-600 flex-shrink-0 mt-0.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <div>
                  <h4 className="text-xs font-bold text-emerald-950 uppercase tracking-wider">
                    Base de Datos FEU Sincronizada
                  </h4>
                  <p className="text-[11px] text-emerald-800 leading-relaxed mt-1 font-medium font-sans">
                    Sincronización nacional realizada con éxito.{" "}
                    {statsData?.activeHorses || 0} binomios habilitados para la
                    próxima competencia oficial.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
