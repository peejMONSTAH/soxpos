import React from 'react';
import { formatPeso } from '@/lib/formatters';
import { cn } from '@/lib/utils';

interface CurrencyTextProps {
  amount: number | string | null | undefined;
  className?: string;
  signClass?: string;
}

export function CurrencyText({ amount, className, signClass }: CurrencyTextProps) {
  const formatted = formatPeso(amount);
  const symbol = formatted.charAt(0); // ₱
  const value = formatted.slice(1);

  return (
    <span className={cn("font-medium tracking-tight whitespace-nowrap", className)}>
      <span className={cn("mr-0.5 text-[0.85em] font-normal opacity-90", signClass)}>{symbol}</span>
      <span>{value}</span>
    </span>
  );
}
