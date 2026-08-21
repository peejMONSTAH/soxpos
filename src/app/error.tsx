'use client';

import React, { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCw, Store } from 'lucide-react';
import Link from 'next/link';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Application Runtime Error:', error);
  }, [error]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-500/10 text-rose-600 mb-4 border border-rose-500/20">
        <AlertTriangle className="h-8 w-8" />
      </div>
      <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Something went wrong</h1>
      <p className="mt-2 text-xs text-muted-foreground max-w-md">
        An unexpected error occurred in the POS terminal. Your offline sales data and local cache remain safe.
      </p>
      {error?.message && (
        <div className="mt-3 p-3 bg-muted/60 rounded-lg text-xs font-mono text-muted-foreground max-w-md break-all border border-border">
          {error.message}
        </div>
      )}
      <div className="mt-6 flex items-center gap-3">
        <Button onClick={() => reset()} variant="emerald" className="gap-2 font-semibold">
          <RefreshCw className="h-4 w-4" />
          Try Again
        </Button>
        <Link href="/pos">
          <Button variant="outline" className="gap-2">
            <Store className="h-4 w-4" />
            Reload Terminal
          </Button>
        </Link>
      </div>
    </div>
  );
}
