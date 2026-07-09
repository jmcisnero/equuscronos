"use client";

import React, { useState, useEffect, use } from "react";
import Link from "next/link";
import { LeaderboardEntry } from "../../../hooks/useLiveLeaderboard";
import { useCompetitions } from "../../../hooks/useCompetitions";
import LeaderboardTable from "../../../components/LeaderboardTable";
import { useSyncStatus } from "../../Providers";

// Datos iniciales de simulación en caso de que la API esté fuera de línea
const INITIAL_SIMULATED_DATA: LeaderboardEntry[] = [
  {
    rank: 1,
    bibNumber: 102,
    riderName: "Lucía Gómez",
    horseName: "Rayo Veloz",
    status: "RESTING",
    currentStage: 2,
    startTime: "2026-03-15T09:29:40Z",
    arrivalTime: "2026-03-15T10:45:00Z",
    lastArrivalTime: "2026-03-15T10:45:00Z",
    nextVetControlTime: "2026-03-15T11:05:00Z",
    totalRaceTimeMs: 9890000,
    gapToLeaderMs: 0,
    averageSpeed: 25.480,
    heartRate: 62,
    nextStageDepartureTime: "2026-03-15T11:45:00Z",
    representedTenant: {
      id: "tenant-1",
      name: "Sociedad Hípica de Melo",
      location: "Melo, Cerro Largo",
    },
    stages: [
      {
        stageNumber: 1,
        distanceKm: 40,
        startTime: "2026-03-15T07:00:00Z",
        arrivalTime: "2026-03-15T08:29:40Z",
        vetInTime: "2026-03-15T08:35:10Z",
        heartRate: 58,
        netTimeMs: 5380000,
        averageSpeed: 26.765,
      }
    ]
  },
  {
    rank: 2,
    bibNumber: 101,
    riderName: "Mateo Silva",
    horseName: "Tormenta Criolla",
    status: "RESTING",
    currentStage: 2,
    startTime: "2026-03-15T09:30:15Z",
    arrivalTime: "2026-03-15T10:46:15Z",
    lastArrivalTime: "2026-03-15T10:46:15Z",
    nextVetControlTime: "2026-03-15T11:06:15Z",
    totalRaceTimeMs: 9975000,
    gapToLeaderMs: 85000,
    averageSpeed: 25.263,
    heartRate: 56,
    nextStageDepartureTime: "2026-03-15T11:46:15Z",
    stages: [
      {
        stageNumber: 1,
        distanceKm: 40,
        startTime: "2026-03-15T07:00:00Z",
        arrivalTime: "2026-03-15T08:30:15Z",
        vetInTime: "2026-03-15T08:38:20Z",
        heartRate: 56,
        netTimeMs: 5415000,
        averageSpeed: 26.592,
      }
    ]
  },
  {
    rank: 3,
    bibNumber: 105,
    riderName: "Daniela Pereira",
    horseName: "Cazador Criollo",
    status: "IN_RACE",
    currentStage: 2,
    startTime: "2026-03-15T09:44:20Z",
    totalRaceTimeMs: 5650000,
    gapToLeaderMs: 270000,
    averageSpeed: 25.487,
    heartRate: 60,
    stages: [
      {
        stageNumber: 1,
        distanceKm: 40,
        startTime: "2026-03-15T07:00:00Z",
        arrivalTime: "2026-03-15T08:34:10Z",
        vetInTime: "2026-03-15T08:44:20Z",
        heartRate: 60,
        netTimeMs: 5650000,
        averageSpeed: 25.487,
      }
    ]
  },
  {
    rank: 4,
    bibNumber: 114,
    riderName: "Agustín Rodríguez",
    horseName: "Pampero Centauro",
    status: "IN_RACE",
    currentStage: 2,
    startTime: "2026-03-15T09:48:15Z",
    totalRaceTimeMs: 5820000,
    gapToLeaderMs: 440000,
    averageSpeed: 24.742,
    heartRate: 58,
    stages: [
      {
        stageNumber: 1,
        distanceKm: 40,
        startTime: "2026-03-15T07:00:00Z",
        arrivalTime: "2026-03-15T08:37:00Z",
        vetInTime: "2026-03-15T08:48:15Z",
        heartRate: 58,
        netTimeMs: 5820000,
        averageSpeed: 24.742,
      }
    ]
  },
  {
    rank: 5,
    bibNumber: 109,
    riderName: "Sofía Martínez",
    horseName: "Centella Blanca",
    status: "DQ",
    currentStage: 2,
    startTime: "2026-03-15T08:52:10Z",
    totalRaceTimeMs: 5990000,
    gapToLeaderMs: 610000,
    averageSpeed: 24.04,
    heartRate: 68,
    stages: [
      {
        stageNumber: 1,
        distanceKm: 40,
        startTime: "2026-03-15T07:00:00Z",
        arrivalTime: "2026-03-15T08:39:50Z",
        vetInTime: "2026-03-15T08:52:10Z",
        heartRate: 68,
        netTimeMs: 5990000,
        averageSpeed: 24.04,
      }
    ]
  },
];

interface LeaderboardPageProps {
  params: Promise<{ id: string }>;
}

export default function LeaderboardPage({ params }: LeaderboardPageProps) {
  const resolvedParams = use(params);
  const competitionId = resolvedParams.id;

  const { competitions } = useCompetitions();
  const currentCompetition = competitions.find((c) => c.id === competitionId);
  const tenant = currentCompetition?.tenant;

  const [searchQuery, setSearchQuery] = useState("");
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [simulatedData, setSimulatedData] = useState<LeaderboardEntry[]>(
    INITIAL_SIMULATED_DATA,
  );
  const [countdown, setCountdown] = useState(30);
  const [hasError, setHasError] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const { setIsConnected } = useSyncStatus();

  useEffect(() => {
    setIsConnected(!hasError);
    return () => {
      setIsConnected(true);
    };
  }, [hasError, setIsConnected]);

  // Manejar contador regresivo de sincronización en vivo
  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          return 30; // Reset
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Simular actualizaciones periódicas de datos en Demo Mode cada 30 segundos
  useEffect(() => {
    if (!isDemoMode) return;

    if (countdown === 30) {
      setSimulatedData((prevData) => {
        return prevData.map((item) => {
          if (item.status === "IN_RACE") {
            const speedDelta = (Math.random() - 0.5) * 0.4;
            const hrDelta = Math.floor((Math.random() - 0.5) * 6);
            return {
              ...item,
              totalRaceTimeMs: item.totalRaceTimeMs + 30000,
              gapToLeaderMs: Math.max(
                0,
                item.gapToLeaderMs + Math.floor((Math.random() - 0.5) * 10000),
              ),
              averageSpeed: Math.max(
                15,
                Math.min(35, item.averageSpeed + speedDelta),
              ),
              heartRate: Math.max(
                48,
                Math.min(68, (item.heartRate || 60) + hrDelta),
              ),
            };
          }
          if (item.status === "RESTING") {
            return {
              ...item,
              heartRate: Math.max(40, (item.heartRate || 60) - 1),
            };
          }
          return item;
        });
      });
    }
  }, [countdown, isDemoMode]);

  // Alerta condicional de error de comunicación con el backend (solo fuera de Modo Demo)
  const shouldShowErrorAlert = hasError && !isDemoMode;

  return (
    <div className="min-h-screen bg-equus-bg font-sans text-equus-text pb-20">
      <div className="relative overflow-hidden bg-slate-900 text-white pt-12 pb-8 px-4 sm:px-6 lg:px-8 shadow-inner">
        {/* Decoraciones de fondo */}
        <div className="absolute top-0 right-0 -mt-4 -mr-4 w-96 h-96 bg-equus-green opacity-20 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 left-0 -mb-4 -ml-4 w-96 h-96 bg-equus-tan-light opacity-10 rounded-full blur-3xl"></div>

        <div className="max-w-7xl mx-auto relative z-10">
          {/* Botón premium de retorno con hitbox de 44px de alto */}
          <div className="mb-6">
            <Link
              href="/"
              className="inline-flex items-center justify-center space-x-2 text-xs font-black text-equus-tan-light hover:text-white transition-all bg-white/5 border border-white/10 px-4 h-11 rounded-xl hover:bg-white/10"
            >
              <svg
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2.5}
                  d="M10 19l-7-7m0 0l7-7m-7 7h18"
                />
              </svg>
              <span>Volver a Competencias</span>
            </Link>
          </div>

          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div className="max-w-2xl">
              <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">
                {currentCompetition?.name ||
                  (isDemoMode
                    ? "Clasificación Simulada (Modo Demo)"
                    : "Monitoreo de Competencia en Vivo")}
              </h1>
              <p className="text-slate-300 mt-2 text-xs sm:text-sm">
                Visualización detallada de tiempos de carrera, pulsaciones,
                promedios y estados veterinarios para el evento seleccionado.
              </p>
            </div>

            <div className="flex items-center space-x-4 bg-white/5 border border-white/10 p-3.5 rounded-2xl w-full lg:w-auto max-w-md lg:flex-shrink-0">
              <div className="flex-shrink-0">
                {tenant?.jerseyImageUrl ? (
                  <img
                    src={tenant.jerseyImageUrl}
                    alt={`Camiseta oficial de ${tenant.name}`}
                    className="w-12 h-12 rounded-full object-cover border-2 border-white/20 shadow-md"
                  />
                ) : (
                  <div
                    className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center border-2 border-white/20 shadow-md text-slate-300"
                    title="Sin camiseta oficial"
                  >
                    <svg
                      className="w-6 h-6"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M9 11l3-3m0 0l3 3m-3-3v8m0-13a9 9 0 110 18 9 9 0 010-18z"
                      />
                    </svg>
                  </div>
                )}
              </div>
              <div>
                <span className="text-[10px] uppercase tracking-wider font-extrabold text-equus-tan-light block">
                  Organizador
                </span>
                <h4 className="font-extrabold text-sm text-white leading-tight">
                  {tenant?.name || "Club no registrado"}
                </h4>
                {tenant?.location && (
                  <p className="text-xs text-slate-400 mt-0.5">
                    {tenant.location}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. ÁREA DE CONTENIDO */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-10">
        {/* 2.1 ALERTA DE ERROR */}
        {shouldShowErrorAlert && (
          <div className="mb-8 bg-rose-50 border-l-4 border-rose-500 rounded-xl p-5 shadow-sm animate-fade-in">
            <div className="flex items-start space-x-3">
              <div className="p-2 rounded-lg bg-rose-100 text-rose-700 flex-shrink-0">
                <svg
                  className="h-5 w-5"
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
              </div>
              <div>
                <h3 className="text-sm font-bold text-rose-900">
                  Conexión en vivo temporalmente no disponible
                </h3>
                <p className="text-xs text-rose-700 mt-1">
                  No fue posible contactar al servidor de cronometraje en este
                  momento.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* 2.2 BARRA DE BÚSQUEDA */}
        <div className="mb-6 max-w-md">
          <div className="relative">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
              <svg
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </span>
            <input
              type="text"
              placeholder="Buscar por Jinete, Caballo o Dorsal..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white text-slate-900 border border-slate-200 pl-10 pr-4 py-2.5 rounded-xl shadow-sm text-sm focus:outline-none focus:border-equus-green"
            />
          </div>
        </div>

        {/* 2.3 COMPONENTE TABLA DE POSICIONES (Consumo de API o Mock mediante SWR) */}
        <LeaderboardTable
          competitionId={competitionId}
          searchQuery={searchQuery}
          isDemoMode={isDemoMode}
          simulatedData={simulatedData}
          onErrorChange={setHasError}
          onValidatingChange={setIsValidating}
        />
      </main>
    </div>
  );
}
