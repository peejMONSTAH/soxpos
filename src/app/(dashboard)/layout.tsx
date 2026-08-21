'use client';

import React, { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Header } from '@/components/layout/Header';
import { Sidebar } from '@/components/layout/Sidebar';
import { MobileNav } from '@/components/layout/MobileNav';
import { useAuthStore } from '@/stores/authStore';
import { toast } from 'sonner';

const OWNER_ONLY_ROUTES = [
  '/dashboard',
  '/inventory',
  '/products',
  '/expenses',
  '/staff',
  '/reports',
  '/settings',
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const initialize = useAuthStore((state) => state.initialize);
  const role = useAuthStore((state) => state.role);
  const isLoading = useAuthStore((state) => state.isLoading);

  useEffect(() => {
    initialize();
  }, [initialize]);

  // Route protection for cashier staff
  useEffect(() => {
    if (!isLoading && role === 'staff') {
      const isOwnerRoute = OWNER_ONLY_ROUTES.some(
        (route) => pathname === route || pathname.startsWith(`${route}/`)
      );
      if (isOwnerRoute) {
        toast.error('Access Restricted', {
          description: 'Cashier accounts can only access the POS Terminal, Sales, and Shift panels.',
        });
        router.replace('/pos');
      }
    }
  }, [pathname, role, isLoading, router]);

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      <Header />
      <div className="flex-1 flex min-h-0 overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-y-auto pb-16 md:pb-6 focus:outline-none min-h-0">
          {children}
        </main>
      </div>
      <MobileNav />
    </div>
  );
}
