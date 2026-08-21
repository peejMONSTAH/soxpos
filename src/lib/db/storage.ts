import { supabase, isSupabaseConfigured } from '@/lib/supabase/client';
import { 
  Business, 
  Profile, 
  Category, 
  Product, 
  Shift, 
  Sale, 
  Expense, 
  InventoryMovement, 
  AuditLog,
  ShiftSchedule 
} from '@/types/database.types';
import { 
  SEED_BUSINESS, 
  SEED_USERS, 
  SEED_CATEGORIES, 
  SEED_PRODUCTS, 
  SEED_SHIFTS, 
  SEED_SALES, 
  SEED_MOVEMENTS, 
  SEED_EXPENSES, 
  SEED_AUDIT_LOGS 
} from '@/lib/seed-data';

// Storage keys for local offline database
export const KEYS = {
  BUSINESS: 'pos_db_business',
  PROFILES: 'pos_db_profiles',
  CATEGORIES: 'pos_db_categories',
  PRODUCTS: 'pos_db_products',
  SHIFTS: 'pos_db_shifts',
  SHIFT_SCHEDULES: 'pos_db_shift_schedules',
  SALES: 'pos_db_sales',
  MOVEMENTS: 'pos_db_movements',
  EXPENSES: 'pos_db_expenses',
  VOIDED_SALES: 'pos_db_voided_sales',
  AUDIT_LOGS: 'pos_db_audit_logs',
  CURRENT_USER: 'pos_db_current_user',
};

// Safe helper to generate valid UUIDs
export function generateUUID(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    try {
      return crypto.randomUUID();
    } catch {}
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// Safe helper for client-side storage
export function getStorage<T>(key: string, defaultVal: T): T {
  if (typeof window === 'undefined') return defaultVal;
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : defaultVal;
  } catch {
    return defaultVal;
  }
}

export function getStorageUsage(): { usedKb: number; percentEstimate: number } {
  if (typeof window === 'undefined') return { usedKb: 0, percentEstimate: 0 };
  try {
    let total = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) {
        total += (localStorage.getItem(key) || '').length * 2; // UTF-16 bytes
      }
    }
    const usedKb = Math.round(total / 1024);
    const percentEstimate = Math.min(100, Math.round((usedKb / 5120) * 100)); // Estimate against 5MB default quota
    return { usedKb, percentEstimate };
  } catch {
    return { usedKb: 0, percentEstimate: 0 };
  }
}

export function setStorage<T>(key: string, val: T): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(val));
  } catch (err: any) {
    console.error(`Error saving to localStorage key: ${key}`, err);
    // If quota exceeded, perform safe pruning on oldest audit logs and cached movements
    if (err?.name === 'QuotaExceededError' || err?.code === 22) {
      try {
        const auditLogs = getStorage<AuditLog[]>(KEYS.AUDIT_LOGS, []);
        if (auditLogs.length > 50) {
          localStorage.setItem(KEYS.AUDIT_LOGS, JSON.stringify(auditLogs.slice(0, 50)));
        }
        const movements = getStorage<InventoryMovement[]>(KEYS.MOVEMENTS, []);
        if (movements.length > 100) {
          localStorage.setItem(KEYS.MOVEMENTS, JSON.stringify(movements.slice(0, 100)));
        }
        // Retry saving original item
        localStorage.setItem(key, JSON.stringify(val));
      } catch (pruneErr) {
        console.error('Critical: LocalStorage full even after pruning', pruneErr);
      }
    }
  }
}

// Helper to ensure business root exists in Supabase
export async function ensureBusinessInSupabase(businessId: string = SEED_BUSINESS.id) {
  if (!isSupabaseConfigured || !supabase) return;
  try {
    const bus = getStorage<Business>(KEYS.BUSINESS, SEED_BUSINESS);
    await supabase.from('businesses').upsert({
      id: businessId,
      name: bus.name || 'SOX POS Store',
      address: bus.address,
      phone: bus.phone,
      currency: 'PHP',
      receipt_header: bus.receipt_header || 'Salamat sa pagpalit!',
      receipt_footer: bus.receipt_footer || 'Please come again.',
    }, { onConflict: 'id' });
  } catch (err) {
    console.warn('Could not auto-sync business root to Supabase:', err);
  }
}

// Initialize offline storage with default seed data
export function initializeLocalDatabase(): void {
  if (typeof window === 'undefined') return;

  // When Supabase is configured, cloud database is the single source of truth
  if (isSupabaseConfigured) {
    return;
  }

  if (!localStorage.getItem(KEYS.BUSINESS)) {
    setStorage(KEYS.BUSINESS, SEED_BUSINESS);
  }
  if (!localStorage.getItem(KEYS.PROFILES)) {
    setStorage(KEYS.PROFILES, SEED_USERS);
  }
  if (!localStorage.getItem(KEYS.CATEGORIES)) {
    setStorage(KEYS.CATEGORIES, SEED_CATEGORIES);
  }
  if (!localStorage.getItem(KEYS.PRODUCTS)) {
    setStorage(KEYS.PRODUCTS, SEED_PRODUCTS);
  }
  if (!localStorage.getItem(KEYS.SHIFTS)) {
    setStorage(KEYS.SHIFTS, SEED_SHIFTS);
  }
  if (!localStorage.getItem(KEYS.SALES)) {
    setStorage(KEYS.SALES, SEED_SALES);
  }
  if (!localStorage.getItem(KEYS.MOVEMENTS)) {
    setStorage(KEYS.MOVEMENTS, SEED_MOVEMENTS);
  }
  if (!localStorage.getItem(KEYS.EXPENSES)) {
    setStorage(KEYS.EXPENSES, SEED_EXPENSES);
  }
  if (!localStorage.getItem(KEYS.AUDIT_LOGS)) {
    setStorage(KEYS.AUDIT_LOGS, SEED_AUDIT_LOGS);
  }
  if (!localStorage.getItem(KEYS.CURRENT_USER)) {
    setStorage(KEYS.CURRENT_USER, SEED_USERS[0]);
  }
}

// Helper to check valid UUID format
const isValidUUID = (val?: string | null): boolean =>
  Boolean(val && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val));

// Ensure business root and core initialization in Supabase cloud
export async function syncLocalToSupabase(): Promise<void> {
  if (!isSupabaseConfigured || !supabase) return;
  try {
    // 0. Ensure Business Root Exists
    await ensureBusinessInSupabase();

    // 1. Sync profiles (Supabase cloud is master)
    try {
      const { data: cloudProfiles, error: pErr } = await supabase.from('profiles').select('*');
      if (!pErr && cloudProfiles) {
        setStorage(KEYS.PROFILES, cloudProfiles);
      }
    } catch (profErr) {
      console.warn('Sync profiles warning:', profErr);
    }
  } catch (err) {
    console.error('Database sync error:', err);
  }
}
