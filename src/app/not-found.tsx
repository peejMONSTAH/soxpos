'use client';

import React from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Store, ArrowLeft, Home } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-600/10 text-emerald-600 mb-4">
        <Store className="h-8 w-8" />
      </div>
      <h1 className="text-4xl font-extrabold tracking-tight text-foreground sm:text-5xl">404</h1>
      <p className="mt-2 text-base font-semibold text-muted-foreground">Page Not Found</p>
      <p className="mt-1 text-xs text-muted-foreground max-w-sm">
        The requested screen or terminal route could not be found or has been moved.
      </p>
      <div className="mt-6 flex items-center gap-3">
        <Link href="/pos">
          <Button variant="emerald" className="gap-2 font-semibold">
            <Store className="h-4 w-4" />
            Back to POS Terminal
          </Button>
        </Link>
        <Link href="/dashboard">
          <Button variant="outline" className="gap-2">
            <Home className="h-4 w-4" />
            Dashboard
          </Button>
        </Link>
      </div>
    </div>
  );
}
