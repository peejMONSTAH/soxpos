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

// Sync all local cache records to Supabase cloud
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

    // 2. Sync categories
    try {
      const localCats = getStorage<Category[]>(KEYS.CATEGORIES, []);
      for (const cat of localCats) {
        if (isValidUUID(cat.id)) {
          await supabase.from('categories').upsert(
            {
              id: cat.id,
              business_id: isValidUUID(cat.business_id) ? cat.business_id : SEED_BUSINESS.id,
              name: cat.name,
              description: cat.description || null,
              is_active: cat.is_active ?? true,
              is_kitchen: cat.is_kitchen ?? false,
            },
            { onConflict: 'id' }
          );
        }
      }
    } catch (catErr) {
      console.warn('Sync categories warning:', catErr);
    }

    // 3. Sync products
    try {
      const { data: remoteProds } = await supabase.from('products').select('id');
      const remoteIdSet = new Set((remoteProds || []).map((p: any) => p.id));
      const localProds = getStorage<Product[]>(KEYS.PRODUCTS, []);

      for (const prod of localProds) {
        if (isValidUUID(prod.id) && !remoteIdSet.has(prod.id)) {
          let safeCatId: string | null = isValidUUID(prod.category_id) ? prod.category_id! : null;
          if (prod.category_id === 'cat-kitchen') safeCatId = 'c0000000-0000-0000-0000-000000000002';
          if (prod.category_id === 'cat-store') safeCatId = 'c0000000-0000-0000-0000-000000000001';

          await supabase.from('products').insert({
            id: prod.id,
            business_id: isValidUUID(prod.business_id) ? prod.business_id : SEED_BUSINESS.id,
            category_id: safeCatId,
            name: prod.name,
            description: prod.description || null,
            selling_price: prod.selling_price,
            cost_price: prod.cost_price,
            stock_quantity: prod.stock_quantity,
            minimum_stock: prod.minimum_stock,
            unit: prod.unit || 'piece',
            image_url: prod.image_url || null,
            is_kitchen: Boolean(
              prod.is_kitchen ||
                prod.category_id === 'cat-kitchen' ||
                safeCatId === 'c0000000-0000-0000-0000-000000000002'
            ),
            status: prod.status || 'active',
          });
        }
      }
    } catch (prodErr) {
      console.warn('Sync products warning:', prodErr);
    }

    // 4. Sync Shifts
    try {
      const localShifts = getStorage<Shift[]>(KEYS.SHIFTS, []);
      for (const sh of localShifts) {
        if (isValidUUID(sh.id)) {
          const shiftPayload: any = {
            id: sh.id,
            business_id: isValidUUID(sh.business_id) ? sh.business_id : SEED_BUSINESS.id,
            user_id: isValidUUID(sh.user_id) ? sh.user_id : null,
            shift_type: sh.shift_type || 'custom',
            start_time: sh.start_time,
            end_time: sh.end_time || null,
            opening_cash: sh.opening_cash || 0,
            expected_cash: sh.expected_cash || null,
            actual_cash: sh.actual_cash || null,
            cash_difference: sh.cash_difference || null,
            status: sh.status || 'open',
            notes: sh.notes || null,
          };
          const { error: shErr } = await supabase.from('shifts').upsert(shiftPayload, { onConflict: 'id' });
          if (shErr && shErr.message?.includes('user_id')) {
            shiftPayload.user_id = null;
            await supabase.from('shifts').upsert(shiftPayload, { onConflict: 'id' });
          }
        }
      }
    } catch (shiftErr) {
      console.warn('Sync shifts warning:', shiftErr);
    }

    // 5. Sync Sales & Sale Items
    const { data: remoteSales } = await supabase.from('sales').select('id');
    const remoteSaleIdSet = new Set((remoteSales || []).map((s: any) => s.id));
    const localSales = getStorage<Sale[]>(KEYS.SALES, []);

    // Get current remote products to validate FK in sale items
    const { data: currentRemoteProducts } = await supabase.from('products').select('id');
    const validProductIds = new Set((currentRemoteProducts || []).map((p: any) => p.id));

    for (const sale of localSales) {
      if (isValidUUID(sale.id) && !remoteSaleIdSet.has(sale.id)) {
        const salePayload: any = {
          id: sale.id,
          business_id: isValidUUID(sale.business_id) ? sale.business_id : SEED_BUSINESS.id,
          user_id: isValidUUID(sale.user_id) ? sale.user_id : null,
          shift_id: isValidUUID(sale.shift_id) ? sale.shift_id : null,
          receipt_number: sale.receipt_number,
          status: sale.status || 'completed',
          subtotal: sale.subtotal,
          discount: sale.discount,
          total: sale.total,
          payment_method: sale.payment_method,
          amount_paid: sale.amount_paid,
          change: sale.change,
          payment_reference: sale.payment_reference || null,
          notes: sale.notes || null,
          created_at: sale.created_at,
        };

        let { error: saleErr } = await supabase.from('sales').insert(salePayload);

        // Fallback retry if shift foreign key or user foreign key failed
        if (saleErr) {
          if (saleErr.message?.includes('shift_id')) {
            salePayload.shift_id = null;
          }
          if (saleErr.message?.includes('user_id')) {
            salePayload.user_id = null;
          }
          const retryRes = await supabase.from('sales').insert(salePayload);
          saleErr = retryRes.error;
        }

        if (!saleErr && sale.items && sale.items.length > 0) {
          const itemsPayload = sale.items.map((item) => ({
            id: isValidUUID(item.id) ? item.id : generateUUID(),
            sale_id: sale.id,
            product_id: isValidUUID(item.product_id) && validProductIds.has(item.product_id) ? item.product_id : null,
            product_name_snapshot: item.product_name_snapshot,
            quantity: item.quantity,
            unit_price: item.unit_price,
            cost_price_snapshot: item.cost_price_snapshot || 0,
            subtotal: item.subtotal,
          }));

          let { error: itemsErr } = await supabase.from('sale_items').insert(itemsPayload);
          if (itemsErr && itemsErr.message?.includes('product_id')) {
            const safeItems = itemsPayload.map((it) => ({ ...it, product_id: null }));
            await supabase.from('sale_items').insert(safeItems);
          }
        }
      }
    }

    // 6. Sync Inventory Movements
    try {
      const { data: remoteMovements } = await supabase.from('inventory_movements').select('id');
      const remoteMovementIdSet = new Set((remoteMovements || []).map((m: any) => m.id));
      const localMovements = getStorage<InventoryMovement[]>(KEYS.MOVEMENTS, []);

      for (const mov of localMovements) {
        if (isValidUUID(mov.id) && !remoteMovementIdSet.has(mov.id) && validProductIds.has(mov.product_id)) {
          const movPayload: any = {
            id: mov.id,
            business_id: isValidUUID(mov.business_id) ? mov.business_id : SEED_BUSINESS.id,
            product_id: mov.product_id,
            type: mov.type,
            quantity: mov.quantity,
            previous_stock: mov.previous_stock,
            new_stock: mov.new_stock,
            reference_id: mov.reference_id || null,
            reason: mov.reason || null,
            created_by: isValidUUID(mov.created_by) ? mov.created_by : null,
            created_at: mov.created_at,
          };

          let { error: mErr } = await supabase.from('inventory_movements').insert(movPayload);
          if (mErr && mErr.message?.includes('created_by')) {
            movPayload.created_by = null;
            await supabase.from('inventory_movements').insert(movPayload);
          }
        }
      }
    } catch (movErr) {
      console.warn('Sync inventory movements warning:', movErr);
    }

    // 7. Sync Expenses
    try {
      const { data: remoteExpenses } = await supabase.from('expenses').select('id');
      const remoteExpenseIdSet = new Set((remoteExpenses || []).map((e: any) => e.id));
      const localExpenses = getStorage<Expense[]>(KEYS.EXPENSES, []);

      for (const exp of localExpenses) {
        if (isValidUUID(exp.id) && !remoteExpenseIdSet.has(exp.id)) {
          const expPayload: any = {
            id: exp.id,
            business_id: isValidUUID(exp.business_id) ? exp.business_id : SEED_BUSINESS.id,
            description: exp.description,
            category: exp.category,
            amount: exp.amount,
            date: exp.date,
            notes: exp.notes || null,
            created_by: isValidUUID(exp.created_by) ? exp.created_by : null,
            created_at: exp.created_at,
          };

          let { error: expErr } = await supabase.from('expenses').insert(expPayload);
          if (expErr && expErr.message?.includes('created_by')) {
            expPayload.created_by = null;
            await supabase.from('expenses').insert(expPayload);
          }
        }
      }
    } catch (expErr) {
      console.warn('Sync expenses warning:', expErr);
    }

    // 8. Sync Shift Schedules
    try {
      const { data: remoteSchedules } = await supabase.from('shift_schedules').select('id');
      const remoteScheduleIdSet = new Set((remoteSchedules || []).map((s: any) => s.id));
      const localSchedules = getStorage<ShiftSchedule[]>(KEYS.SHIFT_SCHEDULES, []);

      for (const sch of localSchedules) {
        if (isValidUUID(sch.id) && !remoteScheduleIdSet.has(sch.id)) {
          const schPayload: any = {
            id: sch.id,
            business_id: isValidUUID(sch.business_id) ? sch.business_id : SEED_BUSINESS.id,
            user_id: isValidUUID(sch.user_id) ? sch.user_id : null,
            shift_name: sch.shift_name,
            shift_type: sch.shift_type || 'custom',
            schedule_date: sch.schedule_date,
            start_time: sch.start_time,
            end_time: sch.end_time || null,
            status: sch.status || 'scheduled',
            notes: sch.notes || null,
          };

          let { error: schErr } = await supabase.from('shift_schedules').insert(schPayload);
          if (schErr && schErr.message?.includes('user_id')) {
            schPayload.user_id = null;
            await supabase.from('shift_schedules').insert(schPayload);
          }
        }
      }
    } catch (schErr) {
      console.warn('Sync shift schedules warning:', schErr);
    }

    // 9. Sync Audit Logs
    try {
      const { data: remoteLogs } = await supabase.from('audit_logs').select('id');
      const remoteLogIdSet = new Set((remoteLogs || []).map((l: any) => l.id));
      const localLogs = getStorage<AuditLog[]>(KEYS.AUDIT_LOGS, []);

      for (const log of localLogs.slice(0, 50)) {
        if (isValidUUID(log.id) && !remoteLogIdSet.has(log.id)) {
          const logPayload: any = {
            id: log.id,
            business_id: isValidUUID(log.business_id) ? log.business_id : SEED_BUSINESS.id,
            user_id: isValidUUID(log.user_id) ? log.user_id : null,
            user_name: log.user_name || 'System',
            action: log.action,
            entity: log.entity,
            entity_id: log.entity_id || null,
            details: log.details || null,
            created_at: log.created_at,
          };

          let { error: lErr } = await supabase.from('audit_logs').insert(logPayload);
          if (lErr && lErr.message?.includes('user_id')) {
            logPayload.user_id = null;
            await supabase.from('audit_logs').insert(logPayload);
          }
        }
      }
    } catch (lErr) {
      console.warn('Sync audit logs warning:', lErr);
    }

    // 10. Sync Voided Sales
    try {
      const { data: remoteVoided } = await supabase.from('voided_sales').select('id');
      const remoteVoidedIdSet = new Set((remoteVoided || []).map((v: any) => v.id));
      const localVoided = getStorage<any[]>(KEYS.VOIDED_SALES, []);

      for (const v of localVoided) {
        if (isValidUUID(v.id) && !remoteVoidedIdSet.has(v.id)) {
          const vPayload: any = {
            id: v.id,
            business_id: isValidUUID(v.business_id) ? v.business_id : SEED_BUSINESS.id,
            sale_id: v.sale_id,
            receipt_number: v.receipt_number,
            total_amount: v.total_amount,
            void_reason: v.void_reason,
            voided_by: isValidUUID(v.voided_by) ? v.voided_by : null,
            restock_items: v.restock_items ?? true,
            notes: v.notes || null,
            created_at: v.created_at,
          };

          let { error: vErr } = await supabase.from('voided_sales').insert(vPayload);
          if (vErr && vErr.message?.includes('voided_by')) {
            vPayload.voided_by = null;
            await supabase.from('voided_sales').insert(vPayload);
          }
        }
      }
    } catch (vErr) {
      console.warn('Sync voided sales warning:', vErr);
    }
  } catch (err) {
    console.error('Error syncing local cache to Supabase:', err);
    throw err;
  }
}
