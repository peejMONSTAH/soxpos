'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';

export default function RootPage() {
  const router = useRouter();
  const { role, isLoading, initialize } = useAuthStore();

  useEffect(() => {
    initialize();
  }, [initialize]);

  useEffect(() => {
    if (!isLoading) {
      if (role === 'owner') {
        router.replace('/dashboard');
      } else {
        router.replace('/pos');
      }
    }
  }, [role, isLoading, router]);

  return (
    <div className="flex h-screen w-full items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-3 border-primary border-t-transparent" />
        <p className="text-sm text-muted-foreground font-medium">Loading POS Terminal...</p>
      </div>
    </div>
  );
}
