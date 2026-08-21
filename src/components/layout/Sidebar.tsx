'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import {
  LayoutDashboard,
  ShoppingCart,
  ReceiptText,
  Boxes,
  Package,
  Receipt,
  Users,
  BarChart3,
  Settings,
  Clock,
  UserCircle,
  LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface NavItem {
  name: string;
  href: string;
  icon: LucideIcon;
  ownerOnly?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, ownerOnly: true },
  { name: 'POS Terminal', href: '/pos', icon: ShoppingCart },
  { name: 'Sales History', href: '/sales', icon: ReceiptText },
  { name: 'Inventory', href: '/inventory', icon: Boxes, ownerOnly: true },
  { name: 'Products', href: '/products', icon: Package, ownerOnly: true },
  { name: 'Expenses', href: '/expenses', icon: Receipt, ownerOnly: true },
  { name: 'Shifts', href: '/shift', icon: Clock },
  { name: 'Staff Management', href: '/staff', icon: Users, ownerOnly: true },
  { name: 'Reports', href: '/reports', icon: BarChart3, ownerOnly: true },
  { name: 'Profile', href: '/profile', icon: UserCircle },
  { name: 'Settings', href: '/settings', icon: Settings, ownerOnly: true },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const role = useAuthStore((state) => state.role);
  const user = useAuthStore((state) => state.user);

  const filteredNav = NAV_ITEMS.filter((item) => {
    if (role === 'staff' && item.ownerOnly) return false;
    return true;
  });

  return (
    <aside className="hidden md:flex w-60 lg:w-64 h-full flex-col border-r border-border bg-card/60 shrink-0 select-none">
      {/* Navigation List */}
      <div className="flex-1 py-4 px-3 space-y-1 overflow-y-auto min-h-0">
        <div className="px-3 pb-2 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
          {role === 'owner' ? 'Management' : 'Cashier Portal'}
        </div>

        {filteredNav.map((item) => {
          const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors duration-150 group active:scale-[0.98]',
                isActive
                  ? 'bg-primary text-primary-foreground shadow-xs font-semibold'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              )}
            >
              <Icon
                className={cn(
                  'h-4 w-4 transition-transform duration-150 group-hover:scale-110',
                  isActive ? 'text-primary-foreground' : 'text-muted-foreground group-hover:text-foreground'
                )}
              />
              <span>{item.name}</span>
            </Link>
          );
        })}
      </div>

      {/* User Footer info & Logout */}
      <div className="p-3 border-t border-border bg-background/50 space-y-2">
        <div className="flex items-center gap-3 px-2 py-1.5 rounded-lg">
          <div className="h-8 w-8 rounded-full bg-emerald-100 dark:bg-emerald-950 flex items-center justify-center text-emerald-700 dark:text-emerald-300 font-semibold text-xs border border-emerald-300 dark:border-emerald-800">
            {user?.full_name?.charAt(0) || 'U'}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-semibold text-foreground truncate">
              {user?.full_name || 'Cashier User'}
            </div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider">
              {role} Account
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={async () => {
            const { useAuthStore } = await import('@/stores/authStore');
            await useAuthStore.getState().logout();
            window.location.href = '/login';
          }}
          className="w-full flex items-center justify-center gap-2 px-3 py-1.5 rounded-md text-xs font-semibold text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
        >
          <span>Sign Out Account</span>
        </button>
      </div>
    </aside>
  );
}
