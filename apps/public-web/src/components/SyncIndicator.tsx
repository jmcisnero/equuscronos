"use client";

import React from "react";
import { useSyncStatus } from "../app/Providers";

export default function SyncIndicator() {
  const { isConnected } = useSyncStatus();

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
