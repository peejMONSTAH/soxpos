'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import { useShiftStore } from '@/stores/shiftStore';
import { ShiftStatusBadge } from './ShiftStatusBadge';
import { UserRoleSwitcher } from './UserRoleSwitcher';
import { ThemeToggle } from './ThemeToggle';
import { Store, Wifi, WifiOff, LogOut } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

export function Header() {
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const { fetchActiveShift } = useShiftStore();
  const [isOnline, setIsOnline] = useState(true);

  const handleLogout = async () => {
    try {
      await logout();
      toast.success('Signed out successfully');
      router.push('/login');
    } catch (err: any) {
      toast.error('Sign out error', { description: err?.message });
    }
  };

  useEffect(() => {
    setIsOnline(navigator.onLine);
    const triggerSync = async () => {
      setIsOnline(true);
      try {
        const { dbService } = await import('@/lib/db');
        await dbService.syncLocalToSupabase();
      } catch (err) {
        console.warn('Background sync warning:', err);
      }
    };

    triggerSync();

    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', triggerSync);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', triggerSync);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    if (user?.id) {
      fetchActiveShift(user.id);
    }
  }, [user, fetchActiveShift]);

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-background/95 px-4 sm:px-6 backdrop-blur-md">
      {/* Left store branding */}
      <div className="flex items-center gap-3">
        <Link href="/" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-600 text-white font-bold shadow-xs">
            <Store className="h-4 w-4" />
          </div>
          <div>
            <div className="text-sm font-bold tracking-tight text-foreground leading-none">
              SOX POS
            </div>
            <div className="text-[10px] text-muted-foreground">
              Local Sales & Inventory
            </div>
          </div>
        </Link>

        {/* Network indicator */}
        <div className="hidden md:flex items-center gap-1.5 pl-2 border-l border-border text-xs text-muted-foreground">
          {isOnline ? (
            <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              Online
            </span>
          ) : (
            <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400 font-medium">
              <WifiOff className="h-3 w-3" />
              Offline Cache
            </span>
          )}
        </div>
      </div>

      {/* Right controls */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Active Shift status */}
        <ShiftStatusBadge />

        {/* Role toggle switcher */}
        <UserRoleSwitcher />

        {/* Dark/Light toggle */}
        <ThemeToggle />

        {/* Log out button */}
        <Button
          variant="ghost"
          size="icon"
          onClick={handleLogout}
          title="Sign Out of SOX POS"
          className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
        >
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    </header>
  );
}
