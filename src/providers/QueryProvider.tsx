'use client';

import React, { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 1000 * 60 * 5, // 5 minutes fresh in-memory cache
            gcTime: 1000 * 60 * 60 * 24, // 24 hours garbage collection retention
            refetchOnWindowFocus: false, // Prevents sudden UI blinks while typing
            refetchOnReconnect: 'always', // Background sync when reconnecting
            retry: 1,
          },
        },
      })
  );

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
