'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import { useSidebarStore } from '@/stores/sidebarStore';
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
  PanelLeftClose,
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
  const isPos = pathname === '/pos';
  const role = useAuthStore((state) => state.role);
  const user = useAuthStore((state) => state.user);

  const { isCollapsed, isPosSidebarOpen, toggleSidebar, togglePosSidebar } = useSidebarStore();
  const collapsed = isPos ? !isPosSidebarOpen : isCollapsed;
  const toggle = isPos ? togglePosSidebar : toggleSidebar;

  const filteredNav = NAV_ITEMS.filter((item) => {
    if (role === 'staff' && item.ownerOnly) return false;
    return true;
  });

  return (
    <aside
      className={cn(
        'hidden md:flex h-full flex-col border-r border-border bg-card/60 shrink-0 select-none overflow-hidden transition-all duration-200 ease-in-out',
        collapsed ? 'w-0 border-r-0 opacity-0 pointer-events-none' : 'w-60 lg:w-64 opacity-100'
      )}
    >
      {/* Navigation List */}
      <div className="flex-1 py-4 px-3 space-y-1 overflow-y-auto min-h-0 w-60 lg:w-64">
        <div className="flex items-center justify-between px-3 pb-2 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
          <span>{role === 'owner' ? 'Management' : 'Cashier Portal'}</span>
          <button
            type="button"
            onClick={toggle}
            className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors"
            title="Collapse Sidebar"
          >
            <PanelLeftClose className="h-3.5 w-3.5" />
          </button>
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
                  'h-4 w-4 shrink-0 transition-transform duration-150 group-hover:scale-110',
                  isActive ? 'text-primary-foreground' : 'text-muted-foreground group-hover:text-foreground'
                )}
              />
              <span className="truncate">{item.name}</span>
            </Link>
          );
        })}
      </div>

      {/* User Footer info & Logout */}
      <div className="p-3 border-t border-border bg-background/50 space-y-2 w-60 lg:w-64">
        <div className="flex items-center gap-3 px-2 py-1.5 rounded-lg">
          <div className="h-8 w-8 rounded-full bg-emerald-100 dark:bg-emerald-950 flex items-center justify-center text-emerald-700 dark:text-emerald-300 font-semibold text-xs border border-emerald-300 dark:border-emerald-800 shrink-0">
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
