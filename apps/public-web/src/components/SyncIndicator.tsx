"use client";

import React, { useMemo } from "react";
import { useSyncStatus } from "../app/Providers";
import { useCompetitions, MOCK_COMPETITIONS } from "../hooks/useCompetitions";

export default function SyncIndicator() {
  const { isConnected } = useSyncStatus();
  const { competitions, error, isLoading } = useCompetitions();

  const isUsingFallback = useMemo(() => {
    return !!error || (competitions.length === 0 && !isLoading);
  }, [error, competitions, isLoading]);

  const activeData = useMemo(() => {
    return isUsingFallback ? MOCK_COMPETITIONS : competitions;
  }, [isUsingFallback, competitions]);

  const hasLiveCompetition = useMemo(() => {
    return activeData.some(
      (c) => c.status === "ACTIVE" || c.status === "PAUSED"
    );
  }, [activeData]);

  // Si no hay competencias en vivo, no se muestra el indicador
  if (!hasLiveCompetition) {
    return null;
  }

  return (
    <div className="flex items-center text-xs font-bold text-white bg-black/25 px-3 py-1.5 rounded-lg border border-white/5 whitespace-nowrap min-h-[32px]">
      {isConnected ? (
        <span className="flex items-center space-x-2">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
          </span>
          <span>TIEMPOS EN VIVO</span>
        </span>
      ) : (
        <span className="flex items-center space-x-2">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-pulse absolute inline-flex h-full w-full rounded-full bg-slate-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-slate-350"></span>
          </span>
          <span>RECONECTANDO...</span>
        </span>
      )}
    </div>
  );
}
