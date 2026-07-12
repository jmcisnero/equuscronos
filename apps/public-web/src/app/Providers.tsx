"use client";

import React, { createContext, useState, useContext } from "react";
import { SWRConfig } from "swr";

interface SyncStatusContextType {
  isConnected: boolean;
  setIsConnected: (connected: boolean) => void;
}

export const SyncStatusContext = createContext<SyncStatusContextType>({
  isConnected: true,
  setIsConnected: () => {},
});

export const useSyncStatus = () => useContext(SyncStatusContext);

interface ProvidersProps {
  children: React.ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  const [isConnected, setIsConnected] = useState(true);

  return (
    <SyncStatusContext.Provider value={{ isConnected, setIsConnected }}>
      <SWRConfig
        value={{
          // Revalidar al enfocar la pestaña
          revalidateOnFocus: true,
          // Revalidar al recuperar conexión
          revalidateOnReconnect: true,
          // Configuración de reintentos resilientes con Backoff Exponencial en errores 5xx del backend
          onErrorRetry: (
            error: any,
            key: any,
            config: any,
            revalidate: any,
            { retryCount }: { retryCount: number },
          ) => {
            const status = error?.status;

            // No reintentar si es error de cliente 4xx (400, 401, 403, 404, etc.)
            if (status && status < 500) {
              console.log(
                `[SWR] Error de cliente 4xx (${status}). No se reintenta.`,
              );
              return;
            }

            // Límite de reintentos máximos (10) para proteger el servidor
            if (retryCount >= 10) {
              console.error(
                "[SWR] Se alcanzó el límite máximo de reintentos (10).",
              );
              return;
            }

            // Backoff exponencial: 2^retryCount * 1000ms con jitter, máximo de 30 segundos
            const delay = Math.min(
              Math.pow(2, retryCount) * 1000 + Math.random() * 500,
              30000,
            );

            console.warn(
              `[SWR] Error 5xx o de conexión detectado. Reintentando en ${Math.round(delay)}ms... (Intento #${retryCount + 1})`,
            );

            setTimeout(() => revalidate({ retryCount }), delay);
          },
        }}
      >
        {children}
      </SWRConfig>
    </SyncStatusContext.Provider>
  );
}
