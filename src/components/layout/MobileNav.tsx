'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import { useCartStore } from '@/stores/cartStore';
import { MobileMenuDrawer } from './MobileMenuDrawer';
import {
  LayoutDashboard,
  ShoppingCart,
  ReceiptText,
  Settings,
  Clock,
  Menu,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export function MobileNav() {
  const pathname = usePathname();
  const role = useAuthStore((state) => state.role);
  const itemCount = useCartStore((state) => state.getItemCount());
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Compact bottom nav items for mobile
  const items = React.useMemo(() => {
    return role === 'owner'
      ? [
          { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
          { name: 'POS', href: '/pos', icon: ShoppingCart, hasBadge: true },
          { name: 'Sales', href: '/sales', icon: ReceiptText },
          { name: 'Settings', href: '/settings', icon: Settings },
        ]
      : [
          { name: 'POS', href: '/pos', icon: ShoppingCart, hasBadge: true },
          { name: 'Sales', href: '/sales', icon: ReceiptText },
          { name: 'Shift', href: '/shift', icon: Clock },
        ];
  }, [role]);

  return (
    <>
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-background/95 border-t border-border backdrop-blur-md pb-[env(safe-area-inset-bottom)]">
        <div className="flex items-center justify-around h-14 px-2">
          {items.map((item) => {
            const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'relative flex flex-col items-center justify-center flex-1 py-1 text-[11px] font-medium transition-colors duration-150 active:scale-95',
                  isActive ? 'text-emerald-600 font-semibold' : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <div className="relative">
                  <Icon className={cn('h-5 w-5', isActive && 'stroke-[2.5px]')} />
                  {item.hasBadge && itemCount > 0 && (
                    <span className="absolute -top-1 -right-2.5 flex h-4 min-w-4 px-1 items-center justify-center rounded-full bg-emerald-600 text-[10px] font-bold text-white shadow-xs">
                      {itemCount}
                    </span>
                  )}
                </div>
                <span className="mt-0.5">{item.name}</span>
              </Link>
            );
          })}

          {/* More Menu Drawer Trigger */}
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="relative flex flex-col items-center justify-center flex-1 py-1 text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors active:scale-95"
          >
            <Menu className="h-5 w-5" />
            <span className="mt-0.5">Menu</span>
          </button>
        </div>
      </nav>

      {/* Controlled Mobile Drawer */}
      <MobileMenuDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
      />
    </>
  );
}
