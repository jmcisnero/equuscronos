"use client";

import React, { useState, useEffect, use } from "react";
import Link from "next/link";
import { useCompetitions } from "../../../hooks/useCompetitions";
import LeaderboardTable from "../../../components/LeaderboardTable";
import FinalResultsTable from "../../../components/FinalResultsTable";
import { useLiveLeaderboard } from "../../../hooks/useLiveLeaderboard";
import { useSyncStatus } from "../../Providers";

interface LeaderboardPageProps {
  params: Promise<{ id: string }>;
}

export default function LeaderboardPage({ params }: LeaderboardPageProps) {
  const resolvedParams = use(params);
  const competitionId = resolvedParams.id;

  const { competitions } = useCompetitions();
  const currentCompetition = competitions.find((c) => c.id === competitionId);
  const tenant = currentCompetition?.tenant;

  // Consumir el hook de live leaderboard aquí para orquestar la vista
  const { leaderboard, error, isLoading, isValidating: hookIsValidating, isClosed } =
    useLiveLeaderboard(competitionId);

  const [searchQuery, setSearchQuery] = useState("");
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

  // Alerta condicional de error de comunicación con el backend
  const shouldShowErrorAlert = hasError;

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
                {currentCompetition?.name || "Monitoreo de Competencia en Vivo"}
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
        {isClosed ? (
          <FinalResultsTable
            competitionId={competitionId}
            searchQuery={searchQuery}
            leaderboard={leaderboard}
            isLoading={isLoading}
            error={error}
            isValidating={hookIsValidating}
            onErrorChange={setHasError}
            onValidatingChange={setIsValidating}
            maxHeartRate={currentCompetition?.maxHeartRate}
          />
        ) : (
          <LeaderboardTable
            competitionId={competitionId}
            searchQuery={searchQuery}
            leaderboard={leaderboard}
            isLoading={isLoading}
            error={error}
            isValidating={hookIsValidating}
            isClosed={isClosed}
            onErrorChange={setHasError}
            onValidatingChange={setIsValidating}
          />
        )}
      </main>
    </div>
  );
}
