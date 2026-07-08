"use client";

import React from "react";
import { useSyncStatus } from "../app/Providers";

export default function SyncIndicator() {
  const { isConnected } = useSyncStatus();

  return (
    <div className="flex items-center space-x-2 text-xs font-bold text-white bg-black/25 px-3 py-1.5 rounded-lg border border-white/5 whitespace-nowrap">
      {isConnected ? "🟢 TIEMPOS EN VIVO" : "⚪ RECONECTANDO..."}
    </div>
  );
}
