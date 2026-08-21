'use client';

import React from 'react';
import { useShiftStore } from '@/stores/shiftStore';
import { Badge } from '@/components/ui/badge';
import { Clock, Sun, Moon, AlertCircle } from 'lucide-react';
import Link from 'next/link';

export function ShiftStatusBadge() {
  const { activeShift } = useShiftStore();

  if (!activeShift) {
    return (
      <Link href="/shift">
        <Badge
          variant="warning"
          className="cursor-pointer gap-1.5 px-3 py-1 text-xs font-medium hover:bg-amber-100 dark:hover:bg-amber-950 transition-all animate-pulse-subtle"
        >
          <AlertCircle className="h-3.5 w-3.5" />
          <span>No Active Shift</span>
        </Badge>
      </Link>
    );
  }

  return (
    <Link href="/shift">
      <Badge
        variant="success"
        className="cursor-pointer gap-1.5 px-3 py-1 text-xs font-medium hover:bg-emerald-100 dark:hover:bg-emerald-950 transition-all"
      >
        {activeShift.shift_type === 'morning' ? (
          <Sun className="h-3.5 w-3.5 text-amber-500" />
        ) : (
          <Moon className="h-3.5 w-3.5 text-indigo-400" />
        )}
        <span className="capitalize">{activeShift.shift_type} Shift Active</span>
      </Badge>
    </Link>
  );
}
