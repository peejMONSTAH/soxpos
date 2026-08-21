import { supabase, isSupabaseConfigured } from '@/lib/supabase/client';
import { Sale, SaleItem, PaymentMethod, Product, Shift, VoidedSale } from '@/types/database.types';
import { SEED_BUSINESS, SEED_USERS } from '@/lib/seed-data';
import { generateReceiptNumber } from '@/lib/formatters';
import { KEYS, generateUUID, getStorage, setStorage, ensureBusinessInSupabase } from '../storage';
import { profilesRepo } from './profiles.repo';
import { movementsRepo } from './movements.repo';
import { auditLogsRepo } from './audit-logs.repo';

export const salesRepo = {
  async getSales(): Promise<Sale[]> {
    const localSales = getStorage<Sale[]>(KEYS.SALES, []);
    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase
          .from('sales')
          .select('*, sale_items(*), profiles(full_name)')
          .order('created_at', { ascending: false });
        if (data && !error) {
          const cloudSales = data.map((s: any) => ({
            ...s,
            user_name: s.profiles?.full_name || 'Cashier',
            items: s.sale_items || [],
          })) as Sale[];
          setStorage(KEYS.SALES, cloudSales);
          return cloudSales;
        }
      } catch (err) {
        console.warn('Error loading sales from Supabase:', err);
      }
    }
    return localSales;
  },

  async createSale(saleData: {
    user_id?: string;
    shift_id?: string;
    payment_method: PaymentMethod;
    subtotal: number;
    discount: number;
    total: number;
    amount_paid: number;
    change: number;
    payment_reference?: string;
    notes?: string;
    items: Array<{
      product_id: string;
      product_name_snapshot: string;
      cost_price_snapshot: number;
      quantity: number;
      unit_price: number;
      subtotal: number;
      selected_drink_id?: string | null;
      selected_drink_name?: string | null;
    }>;
  }): Promise<Sale> {
    const user = await profilesRepo.getCurrentProfile();
    const saleId = generateUUID();
    const existingSales = getStorage<Sale[]>(KEYS.SALES, []);
    const todayPrefix = new Date().toISOString().slice(0, 10);
    const todayCount = existingSales.filter((s) => s.created_at.startsWith(todayPrefix)).length;
    const receiptNo = generateReceiptNumber(todayCount + 1);

    const saleItems: SaleItem[] = saleData.items.map((item) => ({
      id: generateUUID(),
      sale_id: saleId,
      product_id: item.product_id,
      product_name_snapshot: item.product_name_snapshot,
      cost_price_snapshot: item.cost_price_snapshot,
      quantity: item.quantity,
      unit_price: item.unit_price,
      subtotal: item.subtotal,
    }));

    const activeShift = getStorage<Shift[]>(KEYS.SHIFTS, []).find((s) => s.status === 'open');
    const effectiveShiftId = saleData.shift_id || activeShift?.id || null;

    const newSale: Sale = {
      id: saleId,
      business_id: user?.business_id || SEED_BUSINESS.id,
      user_id: saleData.user_id || user?.id || SEED_USERS[0].id,
      user_name: user?.full_name || 'Cashier',
      shift_id: effectiveShiftId,
      receipt_number: receiptNo,
      status: 'completed',
      subtotal: saleData.subtotal,
      discount: saleData.discount,
      total: saleData.total,
      payment_method: saleData.payment_method,
      amount_paid: saleData.amount_paid,
      change: saleData.change,
      payment_reference: saleData.payment_reference || null,
      notes: saleData.notes || null,
      created_at: new Date().toISOString(),
      items: saleItems,
    };

    // Deduct stocks & record movements (for main items & bundled beverages)
    for (const item of saleData.items) {
      // 1. Deduct Main Product
      const products = getStorage<Product[]>(KEYS.PRODUCTS, []);
      const pIndex = products.findIndex((p) => p.id === item.product_id);
      if (pIndex !== -1) {
        const prevStock = products[pIndex].stock_quantity;
        const newStock = Math.max(0, prevStock - item.quantity);
        products[pIndex].stock_quantity = newStock;
        setStorage(KEYS.PRODUCTS, products);

        await movementsRepo.recordStockMovement({
          product_id: item.product_id,
          type: 'SALE',
          quantity: -item.quantity,
          previous_stock: prevStock,
          new_stock: newStock,
          reference_id: receiptNo,
          reason: `POS Sale ${receiptNo}`,
          created_by: newSale.user_id,
        });

        if (isSupabaseConfigured && supabase) {
          try {
            await supabase.from('products').update({ stock_quantity: newStock }).eq('id', item.product_id);
          } catch (err) {
            console.warn('Error syncing stock deduction to Supabase:', err);
          }
        }
      }

      // 2. Deduct Paired Beverage (if combo drink was selected)
      if (item.selected_drink_id) {
        const currentProducts = getStorage<Product[]>(KEYS.PRODUCTS, []);
        const drinkIdx = currentProducts.findIndex((p) => p.id === item.selected_drink_id);
        if (drinkIdx !== -1) {
          const prevDrinkStock = currentProducts[drinkIdx].stock_quantity;
          const newDrinkStock = Math.max(0, prevDrinkStock - item.quantity);
          currentProducts[drinkIdx].stock_quantity = newDrinkStock;
          setStorage(KEYS.PRODUCTS, currentProducts);

          await movementsRepo.recordStockMovement({
            product_id: item.selected_drink_id,
            type: 'SALE',
            quantity: -item.quantity,
            previous_stock: prevDrinkStock,
            new_stock: newDrinkStock,
            reference_id: receiptNo,
            reason: `POS Drink Combo (${item.product_name_snapshot}) ${receiptNo}`,
            created_by: newSale.user_id,
          });

          if (isSupabaseConfigured && supabase) {
            try {
              await supabase.from('products').update({ stock_quantity: newDrinkStock }).eq('id', item.selected_drink_id);
            } catch (err) {
              console.warn('Error syncing drink stock deduction to Supabase:', err);
            }
          }
        }
      }
    }

    const sales = getStorage<Sale[]>(KEYS.SALES, []);
    sales.unshift(newSale);
    setStorage(KEYS.SALES, sales);

    if (isSupabaseConfigured && supabase) {
      try {
        await ensureBusinessInSupabase(newSale.business_id);

        // Ensure Profile exists in Supabase to satisfy foreign key
        if (newSale.user_id) {
          await supabase.from('profiles').upsert(
            {
              id: newSale.user_id,
              business_id: newSale.business_id,
              role: user?.role || 'owner',
              full_name: newSale.user_name || user?.full_name || 'Cashier',
              status: 'active',
            },
            { onConflict: 'id' }
          );
        }

        // Ensure Shift exists in Supabase if shift_id is provided
        let safeShiftId: string | null = newSale.shift_id || null;
        if (safeShiftId && activeShift) {
          const { error: shiftErr } = await supabase.from('shifts').upsert(
            {
              id: activeShift.id,
              business_id: newSale.business_id,
              user_id: activeShift.user_id || newSale.user_id,
              shift_type: activeShift.shift_type || 'custom',
              start_time: activeShift.start_time,
              opening_cash: activeShift.opening_cash || 0,
              status: activeShift.status || 'open',
            },
            { onConflict: 'id' }
          );
          if (shiftErr) {
            console.warn('Could not upsert shift, falling back to null shift_id:', shiftErr);
            safeShiftId = null;
          }
        }

        const salePayload: any = {
          id: newSale.id,
          business_id: newSale.business_id,
          user_id: newSale.user_id,
          shift_id: safeShiftId,
          receipt_number: newSale.receipt_number,
          status: newSale.status,
          subtotal: newSale.subtotal,
          discount: newSale.discount,
          total: newSale.total,
          payment_method: newSale.payment_method,
          amount_paid: newSale.amount_paid,
          change: newSale.change,
          payment_reference: newSale.payment_reference,
          notes: newSale.notes,
          created_at: newSale.created_at,
        };

        let { error: saleErr } = await supabase.from('sales').insert(salePayload);

        // Fallback retries for foreign keys if shift_id or user_id failed
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

        if (!saleErr) {
          const isUUID = (val?: string | null) =>
            val ? /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val) : false;

          const itemsPayload = saleItems.map((item) => ({
            id: item.id,
            sale_id: item.sale_id,
            product_id: isUUID(item.product_id) ? item.product_id : null,
            product_name_snapshot: item.product_name_snapshot,
            quantity: item.quantity,
            unit_price: item.unit_price,
            cost_price_snapshot: item.cost_price_snapshot || 0,
            subtotal: item.subtotal,
          }));

          let { error: itemsErr } = await supabase.from('sale_items').insert(itemsPayload);
          if (itemsErr && itemsErr.message?.includes('product_id')) {
            // Retry with product_id set to null
            const safeItems = itemsPayload.map((it) => ({ ...it, product_id: null }));
            await supabase.from('sale_items').insert(safeItems);
          }
        } else {
          console.error('Error inserting sale to Supabase:', saleErr);
        }
      } catch (err) {
        console.error('Error inserting sale to Supabase:', err);
      }
    }

    return newSale;
  },

  async updateSaleStatus(id: string, status: 'completed' | 'refunded' | 'cancelled' | 'voided'): Promise<Sale> {
    const sales = getStorage<Sale[]>(KEYS.SALES, []);
    const index = sales.findIndex((s) => s.id === id);
    if (index !== -1) {
      sales[index] = { ...sales[index], status };
      setStorage(KEYS.SALES, sales);
    }

    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.from('sales').update({ status }).eq('id', id);
      } catch (err) {
        console.warn('Error updating sale status in Supabase:', err);
      }
    }

    if (index !== -1) return sales[index];
    throw new Error('Sale not found');
  },

  async voidSale(
    saleId: string,
    options: {
      reason: string;
      voided_by?: string;
      restock_items?: boolean;
      notes?: string;
    }
  ): Promise<{ sale: Sale; voidedRecord: VoidedSale }> {
    const user = await profilesRepo.getCurrentProfile();
    const sales = await this.getSales();
    const targetSale = sales.find((s) => s.id === saleId);

    if (!targetSale) {
      throw new Error(`Sale with ID ${saleId} not found`);
    }

    if (targetSale.status === 'voided') {
      throw new Error(`Sale #${targetSale.receipt_number} is already voided`);
    }

    // 1. Update sale status to 'voided'
    const updatedSale = await this.updateSaleStatus(saleId, 'voided');

    // 2. Automatically restore inventory stock if requested (default: true)
    const shouldRestock = options.restock_items !== false;
    if (shouldRestock && targetSale.items && targetSale.items.length > 0) {
      for (const item of targetSale.items) {
        // 1. Restock Main Product
        if (item.product_id) {
          try {
            await movementsRepo.recordStockMovement({
              product_id: item.product_id,
              type: 'VOID_RETURN',
              quantity: item.quantity,
              reason: `Restock from Voided Receipt #${targetSale.receipt_number}: ${options.reason}`,
              reference_id: targetSale.receipt_number,
              created_by: options.voided_by || user?.id || undefined,
            });
          } catch (mErr) {
            console.warn(`Could not auto-restock item ${item.product_name_snapshot}:`, mErr);
          }
        }

        // 2. Restock Paired Drink Combo (if a beverage was bundled)
        if (item.selected_drink_id) {
          try {
            await movementsRepo.recordStockMovement({
              product_id: item.selected_drink_id,
              type: 'VOID_RETURN',
              quantity: item.quantity,
              reason: `Restock Combo Drink (${item.selected_drink_name || 'Beverage'}) from Voided #${targetSale.receipt_number}`,
              reference_id: targetSale.receipt_number,
              created_by: options.voided_by || user?.id || undefined,
            });
          } catch (dErr) {
            console.warn(`Could not auto-restock combo drink for ${item.product_name_snapshot}:`, dErr);
          }
        }
      }
    }

    // 3. Create the VoidedSale record
    const voidRecord: VoidedSale = {
      id: generateUUID(),
      business_id: targetSale.business_id || user?.business_id || SEED_BUSINESS.id,
      sale_id: targetSale.id,
      receipt_number: targetSale.receipt_number,
      total_amount: targetSale.total,
      void_reason: options.reason,
      voided_by: options.voided_by || user?.id || null,
      voided_by_name: user?.full_name || 'Staff',
      restock_items: shouldRestock,
      notes: options.notes || null,
      created_at: new Date().toISOString(),
    };

    // 4. Save to local storage
    const voidedList = getStorage<VoidedSale[]>(KEYS.VOIDED_SALES, []);
    voidedList.unshift(voidRecord);
    setStorage(KEYS.VOIDED_SALES, voidedList);

    // 5. Persist to Supabase voided_sales table
    if (isSupabaseConfigured && supabase) {
      try {
        const isUUID = (val?: string | null) =>
          Boolean(val && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val));

        const vPayload: any = {
          id: voidRecord.id,
          business_id: isUUID(voidRecord.business_id) ? voidRecord.business_id : SEED_BUSINESS.id,
          sale_id: voidRecord.sale_id,
          receipt_number: voidRecord.receipt_number,
          total_amount: voidRecord.total_amount,
          void_reason: voidRecord.void_reason,
          voided_by: isUUID(voidRecord.voided_by) ? voidRecord.voided_by : null,
          restock_items: voidRecord.restock_items,
          notes: voidRecord.notes || null,
          created_at: voidRecord.created_at,
        };

        let { error: vErr } = await supabase.from('voided_sales').insert(vPayload);
        if (vErr && vErr.message?.includes('voided_by')) {
          vPayload.voided_by = null;
          await supabase.from('voided_sales').insert(vPayload);
        }
      } catch (err) {
        console.warn('Supabase voided_sales table insert warning (will sync when table created):', err);
      }
    }

    // 6. Log detailed audit trail
    await auditLogsRepo.logAudit({
      action: 'VOID_SALE',
      entity: 'SALE',
      entity_id: targetSale.id,
      details: {
        receipt_number: targetSale.receipt_number,
        total: targetSale.total,
        reason: options.reason,
        restocked: shouldRestock,
        voided_by: user?.full_name || 'Staff',
      },
    });

    return { sale: updatedSale, voidedRecord: voidRecord };
  },

  async getVoidedSales(): Promise<VoidedSale[]> {
    const localVoided = getStorage<VoidedSale[]>(KEYS.VOIDED_SALES, []);
    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase
          .from('voided_sales')
          .select('*, profiles(full_name)')
          .order('created_at', { ascending: false });

        if (data && !error) {
          const mapped = data.map((v: any) => ({
            ...v,
            voided_by_name: v.profiles?.full_name || 'Staff',
          })) as VoidedSale[];
          setStorage(KEYS.VOIDED_SALES, mapped);
          return mapped;
        }
      } catch (err) {
        console.warn('Error fetching voided sales from Supabase:', err);
      }
    }
    return localVoided;
  },

  async deleteSale(id: string): Promise<void> {
    const sales = getStorage<Sale[]>(KEYS.SALES, []);
    const filtered = sales.filter((s) => s.id !== id);
    setStorage(KEYS.SALES, filtered);

    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.from('sales').delete().eq('id', id);
      } catch (err) {
        console.warn('Error deleting sale from Supabase:', err);
      }
    }
  },
};
