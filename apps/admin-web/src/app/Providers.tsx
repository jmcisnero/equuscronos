"use client";

import React, { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuthStore } from '@/store/auth.store';

// Interceptor global de fetch en el cliente
if (typeof window !== 'undefined') {
  const originalFetch = window.fetch;
  window.fetch = async (input, init) => {
    const token = useAuthStore.getState().accessToken;
    let modifiedInit = init;

    if (token) {
      const headers = init?.headers;
      let hasAuth = false;

      if (headers) {
        if (headers instanceof Headers) {
          hasAuth = headers.has('Authorization');
        } else if (Array.isArray(headers)) {
          hasAuth = headers.some(([key]) => key.toLowerCase() === 'authorization');
        } else {
          hasAuth = Object.keys(headers).some((key) => key.toLowerCase() === 'authorization');
        }
      }

      if (!hasAuth) {
        const authHeader = { Authorization: `Bearer ${token}` };
        if (!init) {
          modifiedInit = { headers: authHeader };
        } else if (headers instanceof Headers) {
          const newHeaders = new Headers(headers);
          newHeaders.set('Authorization', `Bearer ${token}`);
          modifiedInit = { ...init, headers: newHeaders };
        } else if (Array.isArray(headers)) {
          modifiedInit = {
            ...init,
            headers: [...headers, ['Authorization', `Bearer ${token}`]],
          };
        } else {
          modifiedInit = {
            ...init,
            headers: {
              ...headers,
              ...authHeader,
            },
          };
        }
      }
    }

    return originalFetch(input, modifiedInit);
  };
}

interface ProvidersProps {
  children: React.ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            refetchOnWindowFocus: false,
            retry: 1,
            staleTime: 5 * 60 * 1000, // 5 minutes
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}
