import { supabase, isSupabaseConfigured } from '@/lib/supabase/client';
import { InventoryMovement, MovementType, Product, Profile } from '@/types/database.types';
import { SEED_BUSINESS, SEED_USERS } from '@/lib/seed-data';
import { KEYS, generateUUID, getStorage, setStorage } from '../storage';
import { auditLogsRepo } from './audit-logs.repo';

export const movementsRepo = {
  async getInventoryMovements(): Promise<InventoryMovement[]> {
    const localMovements = getStorage<InventoryMovement[]>(KEYS.MOVEMENTS, []);
    const localProds = getStorage<Product[]>(KEYS.PRODUCTS, []);
    const prodMap = new Map(localProds.map((p) => [p.id, p.name]));
    const localProfiles = getStorage<Profile[]>(KEYS.PROFILES, SEED_USERS);
    const profileMap = new Map(localProfiles.map((p) => [p.id, p.full_name]));

    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase
          .from('inventory_movements')
          .select('*, products(name), profiles(full_name)')
          .order('created_at', { ascending: false });
        if (data && !error) {
          const map = new Map<string, InventoryMovement>();
          // Cloud movements take priority
          data.forEach((m: any) => {
            map.set(m.id, {
              ...m,
              product_name: m.products?.name || prodMap.get(m.product_id) || 'Item',
              created_by_name: m.profiles?.full_name || profileMap.get(m.created_by) || 'Staff',
            });
          });
          // Retain any locally recorded movements not yet synced
          localMovements.forEach((m) => {
            if (!map.has(m.id)) {
              map.set(m.id, {
                ...m,
                product_name: m.product_name || prodMap.get(m.product_id) || 'Item',
                created_by_name: m.created_by_name || profileMap.get(m.created_by || '') || 'System',
              });
            }
          });
          const merged = Array.from(map.values()).sort(
            (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          );
          setStorage(KEYS.MOVEMENTS, merged);
          return merged;
        }
      } catch (err) {
        console.warn('Error loading inventory movements from Supabase:', err);
      }
    }

    return localMovements.map((m) => ({
      ...m,
      product_name: m.product_name || prodMap.get(m.product_id) || 'Item',
      created_by_name: m.created_by_name || profileMap.get(m.created_by || '') || 'System',
    }));
  },

  async recordStockMovement(movement: {
    product_id: string;
    type: MovementType;
    quantity: number;
    previous_stock?: number;
    new_stock?: number;
    reference_id?: string;
    reason?: string;
    created_by?: string;
  }): Promise<InventoryMovement> {
    const products = getStorage<Product[]>(KEYS.PRODUCTS, []);
    const pIndex = products.findIndex((p) => p.id === movement.product_id);
    const targetProduct = pIndex !== -1 ? products[pIndex] : null;

    let prevStock = movement.previous_stock ?? 0;
    let nextStock = movement.new_stock ?? 0;

    if (pIndex !== -1) {
      prevStock = products[pIndex].stock_quantity;
      nextStock = Math.max(0, prevStock + movement.quantity);
      products[pIndex].stock_quantity = nextStock;
      products[pIndex].updated_at = new Date().toISOString();
      setStorage(KEYS.PRODUCTS, products);
    }

    if (isSupabaseConfigured && supabase) {
      try {
        const { data: prodData } = await supabase
          .from('products')
          .select('stock_quantity')
          .eq('id', movement.product_id)
          .single();

        if (prodData) {
          prevStock = prodData.stock_quantity;
          nextStock = Math.max(0, prevStock + movement.quantity);
        }

        await supabase
          .from('products')
          .update({ stock_quantity: nextStock, updated_at: new Date().toISOString() })
          .eq('id', movement.product_id);

        if (pIndex !== -1) {
          products[pIndex].stock_quantity = nextStock;
          setStorage(KEYS.PRODUCTS, products);
        }
      } catch (err) {
        console.warn('Error updating product stock in Supabase:', err);
      }
    }

    const newMovement: InventoryMovement = {
      id: generateUUID(),
      business_id: SEED_BUSINESS.id,
      product_id: movement.product_id,
      product_name: targetProduct?.name || 'Item',
      type: movement.type,
      quantity: movement.quantity,
      previous_stock: prevStock,
      new_stock: nextStock,
      reference_id: movement.reference_id || null,
      reason: movement.reason || null,
      created_by: movement.created_by || null,
      created_at: new Date().toISOString(),
    };

    const movements = getStorage<InventoryMovement[]>(KEYS.MOVEMENTS, []);
    movements.unshift(newMovement);
    setStorage(KEYS.MOVEMENTS, movements);

    if (isSupabaseConfigured && supabase) {
      try {
        const isUUID = (val?: string | null) =>
          Boolean(val && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val));

        const movementPayload: any = {
          id: newMovement.id,
          business_id: SEED_BUSINESS.id,
          product_id: newMovement.product_id,
          type: newMovement.type,
          quantity: newMovement.quantity,
          previous_stock: newMovement.previous_stock,
          new_stock: newMovement.new_stock,
          reference_id: newMovement.reference_id || null,
          reason: newMovement.reason || null,
          created_by: isUUID(newMovement.created_by) ? newMovement.created_by : null,
          created_at: newMovement.created_at,
        };

        let { error: movErr } = await supabase.from('inventory_movements').insert(movementPayload);
        if (movErr && movErr.message?.includes('created_by')) {
          movementPayload.created_by = null;
          await supabase.from('inventory_movements').insert(movementPayload);
        }
      } catch (err) {
        console.warn('Error recording movement to Supabase:', err);
      }
    }

    await auditLogsRepo.logAudit({
      action: 'STOCK_MOVEMENT',
      entity: 'PRODUCT',
      entity_id: movement.product_id,
      details: { type: movement.type, qty: movement.quantity, prev: prevStock, new: nextStock },
    });

    return newMovement;
  },
};
