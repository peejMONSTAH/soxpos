import { supabase, isSupabaseConfigured } from '@/lib/supabase/client';
import { AuditLog, Profile } from '@/types/database.types';
import { SEED_BUSINESS, SEED_USERS } from '@/lib/seed-data';
import { KEYS, generateUUID, getStorage, setStorage, ensureBusinessInSupabase } from '../storage';

export const auditLogsRepo = {
  async getAuditLogs(): Promise<AuditLog[]> {
    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase
          .from('audit_logs')
          .select('*, profiles(full_name)')
          .order('created_at', { ascending: false })
          .limit(100);
        if (data && !error) return data as AuditLog[];
      } catch (err) {
        console.warn('Error loading audit logs from Supabase:', err);
      }
    }
    return getStorage<AuditLog[]>(KEYS.AUDIT_LOGS, []);
  },

  async logAudit(log: {
    action: string;
    entity: string;
    entity_id?: string;
    details?: any;
    user_id?: string;
  }): Promise<void> {
    const user = getStorage<Profile | null>(KEYS.CURRENT_USER, SEED_USERS[0]);
    const newLog: AuditLog = {
      id: generateUUID(),
      business_id: user?.business_id || SEED_BUSINESS.id,
      user_id: log.user_id || user?.id || null,
      user_name: user?.full_name || 'System',
      action: log.action,
      entity: log.entity,
      entity_id: log.entity_id || null,
      details: log.details || null,
      created_at: new Date().toISOString(),
    };

    const logs = getStorage<AuditLog[]>(KEYS.AUDIT_LOGS, []);
    logs.unshift(newLog);
    setStorage(KEYS.AUDIT_LOGS, logs.slice(0, 200));

    if (isSupabaseConfigured && supabase) {
      try {
        await ensureBusinessInSupabase(newLog.business_id);
        const isUUID = (val?: string | null) =>
          Boolean(val && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val));

        const logPayload: any = {
          id: newLog.id,
          business_id: newLog.business_id,
          user_id: isUUID(newLog.user_id) ? newLog.user_id : null,
          user_name: newLog.user_name || 'System',
          action: newLog.action,
          entity: newLog.entity,
          entity_id: newLog.entity_id || null,
          details: newLog.details || null,
          created_at: newLog.created_at,
        };

        let { error: logErr } = await supabase.from('audit_logs').insert(logPayload);
        if (logErr && logErr.message?.includes('user_id')) {
          logPayload.user_id = null;
          await supabase.from('audit_logs').insert(logPayload);
        }
      } catch (err) {
        console.warn('Error saving audit log in Supabase:', err);
      }
    }
  },
};
