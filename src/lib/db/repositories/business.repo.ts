import { supabase, isSupabaseConfigured } from '@/lib/supabase/client';
import { Business } from '@/types/database.types';
import { SEED_BUSINESS } from '@/lib/seed-data';
import { KEYS, getStorage, setStorage } from '../storage';
import { auditLogsRepo } from './audit-logs.repo';

export const businessRepo = {
  async getBusiness(): Promise<Business> {
    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase.from('businesses').select('*').single();
        if (data && !error) {
          setStorage(KEYS.BUSINESS, data);
          return data as Business;
        }
      } catch (err) {
        console.warn('Error fetching business from Supabase:', err);
      }
    }
    return getStorage<Business>(KEYS.BUSINESS, SEED_BUSINESS);
  },

  async updateBusiness(updates: Partial<Business>): Promise<Business> {
    const current = getStorage<Business>(KEYS.BUSINESS, SEED_BUSINESS);
    const updated = { ...current, ...updates, updated_at: new Date().toISOString() };
    setStorage(KEYS.BUSINESS, updated);

    if (isSupabaseConfigured && supabase) {
      try {
        await supabase
          .from('businesses')
          .upsert({ ...updated, id: updated.id || SEED_BUSINESS.id }, { onConflict: 'id' });
      } catch (err) {
        console.warn('Error syncing business updates to Supabase:', err);
      }
    }

    await auditLogsRepo.logAudit({
      action: 'UPDATE_SETTINGS',
      entity: 'BUSINESS',
      entity_id: updated.id,
      details: updates,
    });
    return updated;
  },
};
