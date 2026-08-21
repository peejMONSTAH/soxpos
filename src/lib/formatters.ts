import { format, parseISO, isValid } from "date-fns";

/**
 * Format numbers as Philippine Peso (e.g. ₱1,250.00)
 */
export function formatPeso(amount: number | string | null | undefined): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : (amount ?? 0);
  if (isNaN(num)) return '₱0.00';
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}

/**
 * Format a number as integer or decimal with commas without currency sign
 */
export function formatNumber(amount: number | string | null | undefined): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : (amount ?? 0);
  if (isNaN(num)) return '0';
  return new Intl.NumberFormat('en-PH').format(num);
}

/**
 * Format date (e.g., Aug 19, 2026)
 */
export function formatDate(dateInput: string | Date | null | undefined): string {
  if (!dateInput) return '-';
  try {
    const d = typeof dateInput === 'string' ? parseISO(dateInput) : dateInput;
    if (!isValid(d)) return '-';
    return format(d, 'MMM d, yyyy');
  } catch {
    return '-';
  }
}

/**
 * Format time (e.g., 08:30 AM)
 */
export function formatTime(dateInput: string | Date | null | undefined): string {
  if (!dateInput) return '-';
  try {
    const d = typeof dateInput === 'string' ? parseISO(dateInput) : dateInput;
    if (!isValid(d)) return '-';
    return format(d, 'hh:mm a');
  } catch {
    return '-';
  }
}

/**
 * Format HH:MM or HH:MM:SS string to 12-hour AM/PM format (e.g. "08:00" -> "8:00 AM", "16:30" -> "4:30 PM")
 */
export function formatTimeString(timeStr: string | null | undefined): string {
  if (!timeStr) return '-';
  const parts = timeStr.split(':');
  if (parts.length < 2) return timeStr;
  let hours = parseInt(parts[0], 10);
  const minutes = parts[1];
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12;
  return `${hours}:${minutes} ${ampm}`;
}

/**
 * Format full date & time (e.g., Aug 19, 2026 08:30 AM)
 */
export function formatDateTime(dateInput: string | Date | null | undefined): string {
  if (!dateInput) return '-';
  try {
    const d = typeof dateInput === 'string' ? parseISO(dateInput) : dateInput;
    if (!isValid(d)) return '-';
    return format(d, 'MMM d, yyyy · hh:mm a');
  } catch {
    return '-';
  }
}

/**
 * Generate sequential receipt number (e.g. RCP-20260819-0001)
 */
export function generateReceiptNumber(seq: number = 1): string {
  const today = format(new Date(), 'yyyyMMdd');
  return `RCP-${today}-${seq.toString().padStart(4, '0')}`;
}

