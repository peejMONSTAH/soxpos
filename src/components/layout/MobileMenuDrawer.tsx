'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
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
  Menu,
  Store,
  LogOut,
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
  { name: 'Settings & Hardware', href: '/settings', icon: Settings, ownerOnly: true },
  { name: 'Profile', href: '/profile', icon: UserCircle },
];

interface MobileMenuDrawerProps {
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function MobileMenuDrawer({ trigger, open, onOpenChange }: MobileMenuDrawerProps) {
  const [internalOpen, setInternalOpen] = React.useState(false);
  const isControlled = open !== undefined;
  const isOpen = isControlled ? open : internalOpen;
  const setOpen = isControlled ? (onOpenChange || (() => {})) : setInternalOpen;

  const pathname = usePathname();
  const role = useAuthStore((state) => state.role);
  const user = useAuthStore((state) => state.user);

  const filteredNav = NAV_ITEMS.filter((item) => {
    if (role === 'staff' && item.ownerOnly) return false;
    return true;
  });

  return (
    <Sheet open={isOpen} onOpenChange={setOpen}>
      {trigger ? (
        <SheetTrigger asChild>{trigger}</SheetTrigger>
      ) : (
        <SheetTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden h-8 w-8 text-foreground"
            aria-label="Open Navigation Menu"
          >
            <Menu className="h-5 w-5" />
          </Button>
        </SheetTrigger>
      )}

      <SheetContent side="left" className="w-[82vw] max-w-xs p-0 flex flex-col h-full bg-card">
        {/* Header Branding */}
        <SheetHeader className="p-4 border-b border-border bg-emerald-50/40 dark:bg-emerald-950/20 text-left">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-600 text-white font-bold shadow-xs">
              <Store className="h-5 w-5" />
            </div>
            <div>
              <SheetTitle className="text-base font-bold text-foreground">SOX POS</SheetTitle>
              <p className="text-[11px] text-muted-foreground">Management & Cashier Portal</p>
            </div>
          </div>
        </SheetHeader>

        {/* Scrollable Nav Items */}
        <div className="flex-1 overflow-y-auto p-3 space-y-1">
          <div className="px-3 py-1.5 text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
            Navigation Menu
          </div>

          {filteredNav.map((item) => {
            const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors active:scale-[0.98]',
                  isActive
                    ? 'bg-emerald-600 text-white shadow-xs font-semibold'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                )}
              >
                <Icon
                  className={cn(
                    'h-4 w-4',
                    isActive ? 'text-white' : 'text-muted-foreground'
                  )}
                />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </div>

        {/* User Footer */}
        <div className="p-3 border-t border-border bg-muted/30 space-y-2">
          <div className="flex items-center gap-3 px-2 py-1">
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
              setOpen(false);
              const { useAuthStore } = await import('@/stores/authStore');
              await useAuthStore.getState().logout();
              window.location.href = '/login';
            }}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-md text-xs font-semibold text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
