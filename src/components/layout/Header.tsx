'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import { useShiftStore } from '@/stores/shiftStore';
import { ShiftStatusBadge } from './ShiftStatusBadge';
import { UserRoleSwitcher } from './UserRoleSwitcher';
import { ThemeToggle } from './ThemeToggle';
import { MobileMenuDrawer } from './MobileMenuDrawer';
import { Store, Wifi, WifiOff, LogOut, Bluetooth } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { usePrinterStore } from '@/stores/printerStore';

export function Header() {
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const { fetchActiveShift } = useShiftStore();
  const { isConnected: isPrinterConnected, deviceName: printerName } = usePrinterStore();
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
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-background/95 px-3 sm:px-6 backdrop-blur-md">
      {/* Left store branding & Mobile Drawer Menu Trigger */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Mobile Hamburger Drawer Menu */}
        <MobileMenuDrawer />

        <Link href="/" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-600 text-white font-bold shadow-xs">
            <Store className="h-4 w-4" />
          </div>
          <div>
            <div className="text-sm font-bold tracking-tight text-foreground leading-none">
              SOX POS
            </div>
            <div className="text-[10px] text-muted-foreground hidden xs:block">
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

        {/* Bluetooth Thermal Printer Indicator (Accessible on Mobile & Desktop) */}
        <Link
          href="/settings"
          title={isPrinterConnected ? `Bluetooth Printer: ${printerName || 'Connected'}` : 'Bluetooth Thermal Printer: Not Connected (Click to Setup)'}
          className="flex items-center gap-1 pl-1.5 sm:pl-2 sm:border-l border-border text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          {isPrinterConnected ? (
            <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full border border-emerald-300 dark:border-emerald-800">
              <Bluetooth className="h-3.5 w-3.5 text-emerald-600 animate-pulse" />
              <span className="text-[10px] sm:text-xs">{printerName || 'Printer'}</span>
            </span>
          ) : (
            <span className="flex items-center gap-1 text-muted-foreground hover:text-emerald-600 px-1.5 py-0.5 rounded">
              <Bluetooth className="h-3.5 w-3.5 opacity-60" />
              <span className="text-[10px] hidden sm:inline">Printer</span>
            </span>
          )}
        </Link>
      </div>

      {/* Right controls */}
      <div className="flex items-center gap-1.5 sm:gap-3">
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
