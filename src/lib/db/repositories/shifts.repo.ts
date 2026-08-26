import { supabase, isSupabaseConfigured } from '@/lib/supabase/client';
import { Shift, ShiftSchedule, ShiftType, Profile, Sale } from '@/types/database.types';
import { SEED_BUSINESS, SEED_USERS } from '@/lib/seed-data';
import { KEYS, generateUUID, getStorage, setStorage, ensureBusinessInSupabase } from '../storage';
import { auditLogsRepo } from './audit-logs.repo';
import { profilesRepo } from './profiles.repo';

export const shiftsRepo = {
  async getShifts(): Promise<Shift[]> {
    const localShifts = getStorage<Shift[]>(KEYS.SHIFTS, []);
    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase
          .from('shifts')
          .select('*, profiles(full_name)')
          .order('start_time', { ascending: false });
        if (data && !error) {
          const mapped = data.map((s: any) => ({
            ...s,
            user_name: s.profiles?.full_name || 'Staff',
          })) as Shift[];
          setStorage(KEYS.SHIFTS, mapped);
          return mapped;
        }
      } catch (err) {
        console.warn('Error fetching shifts from Supabase:', err);
      }
    }
    return localShifts;
  },

  async getActiveShift(userId?: string): Promise<Shift | null> {
    const localShifts = getStorage<Shift[]>(KEYS.SHIFTS, []);
    const localActive =
      localShifts.find((s) => s.status === 'open' && (!userId || s.user_id === userId)) ||
      localShifts.find((s) => s.status === 'open') ||
      null;

    if (isSupabaseConfigured && supabase) {
      try {
        let query = supabase
          .from('shifts')
          .select('*, profiles(full_name)')
          .eq('status', 'open')
          .order('start_time', { ascending: false })
          .limit(1);

        if (userId) {
          query = query.eq('user_id', userId);
        }

        const { data, error } = await query;
        if (data && data.length > 0 && !error) {
          const mapped: Shift = {
            ...data[0],
            user_name: data[0].profiles?.full_name || 'Staff',
          };
          return mapped;
        } else if (!error) {
          return null;
        }
      } catch (err) {
        console.warn('Error fetching active shift from Supabase:', err);
      }
    }

    return localActive;
  },

  async startShift(
    shiftType: ShiftType,
    openingCash: number,
    notes?: string,
    userId?: string
  ): Promise<Shift> {
    const user = await profilesRepo.getCurrentProfile();
    const effectiveUserId = userId || user?.id || SEED_USERS[0].id;
    const newShift: Shift = {
      id: generateUUID(),
      business_id: user?.business_id || SEED_BUSINESS.id,
      user_id: effectiveUserId,
      user_name: user?.full_name || 'Staff',
      shift_type: shiftType,
      start_time: new Date().toISOString(),
      end_time: null,
      opening_cash: openingCash,
      expected_cash: openingCash,
      actual_cash: null,
      cash_difference: null,
      status: 'open',
      notes: notes || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const shifts = getStorage<Shift[]>(KEYS.SHIFTS, []);
    shifts.unshift(newShift);
    setStorage(KEYS.SHIFTS, shifts);

    if (isSupabaseConfigured && supabase) {
      try {
        await ensureBusinessInSupabase(newShift.business_id);
        const shiftPayload: any = {
          id: newShift.id,
          business_id: newShift.business_id,
          user_id: newShift.user_id,
          shift_type: newShift.shift_type,
          start_time: newShift.start_time,
          end_time: newShift.end_time || null,
          opening_cash: newShift.opening_cash,
          expected_cash: newShift.expected_cash || null,
          actual_cash: newShift.actual_cash || null,
          cash_difference: newShift.cash_difference || null,
          status: newShift.status,
          notes: newShift.notes || null,
        };
        const { error: shErr } = await supabase.from('shifts').insert(shiftPayload);
        if (shErr) {
          console.warn('Error starting shift in Supabase, retrying with null user_id fallback:', shErr);
          shiftPayload.user_id = null;
          await supabase.from('shifts').insert(shiftPayload);
        }
      } catch (err) {
        console.warn('Error starting shift in Supabase:', err);
      }
    }

    await auditLogsRepo.logAudit({
      action: 'START_SHIFT',
      entity: 'SHIFT',
      entity_id: newShift.id,
      details: { type: shiftType, opening_cash: openingCash },
    });
    return newShift;
  },

  async endShift(shiftId: string, actualCash: number, notes?: string): Promise<Shift> {
    const shifts = getStorage<Shift[]>(KEYS.SHIFTS, []);
    const index = shifts.findIndex((s) => s.id === shiftId);
    if (index === -1) throw new Error('Shift not found');

    const currentShift = shifts[index];
    let cashSales = 0;
    if (isSupabaseConfigured && supabase) {
      try {
        const { data: dbSales } = await supabase
          .from('sales')
          .select('total, payment_method, status')
          .eq('shift_id', shiftId)
          .eq('status', 'completed');
        if (dbSales) {
          cashSales = dbSales
            .filter((s: any) => s.payment_method === 'cash')
            .reduce((sum: number, s: any) => sum + (Number(s.total) || 0), 0);
        }
      } catch (err) {
        console.warn('Error fetching shift sales from Supabase:', err);
      }
    } else {
      const localSales = getStorage<Sale[]>(KEYS.SALES, []);
      const shiftSales = localSales.filter((s) => s.shift_id === shiftId && s.status === 'completed');
      cashSales = shiftSales
        .filter((s) => s.payment_method === 'cash')
        .reduce((sum, s) => sum + s.total, 0);
    }

    const expectedCash = currentShift.opening_cash + cashSales;
    const difference = actualCash - expectedCash;

    const closedShift: Shift = {
      ...currentShift,
      end_time: new Date().toISOString(),
      expected_cash: expectedCash,
      actual_cash: actualCash,
      cash_difference: difference,
      status: 'closed',
      notes: notes || currentShift.notes,
      updated_at: new Date().toISOString(),
    };

    shifts[index] = closedShift;
    setStorage(KEYS.SHIFTS, shifts);

    if (isSupabaseConfigured && supabase) {
      try {
        await supabase
          .from('shifts')
          .update({
            end_time: closedShift.end_time,
            expected_cash: closedShift.expected_cash,
            actual_cash: closedShift.actual_cash,
            cash_difference: closedShift.cash_difference,
            status: 'closed',
            notes: closedShift.notes,
            updated_at: closedShift.updated_at,
          })
          .eq('id', shiftId);
      } catch (err) {
        console.warn('Error closing shift in Supabase:', err);
      }
    }

    await auditLogsRepo.logAudit({
      action: 'CLOSE_SHIFT',
      entity: 'SHIFT',
      entity_id: shiftId,
      details: { expected: expectedCash, actual: actualCash, diff: difference },
    });

    return closedShift;
  },

  async closeShift(shiftId: string, actualCash: number, notes?: string): Promise<Shift> {
    return this.endShift(shiftId, actualCash, notes);
  },

  async deleteShift(shiftId: string): Promise<void> {
    const shifts = getStorage<Shift[]>(KEYS.SHIFTS, []);
    const filtered = shifts.filter((s) => s.id !== shiftId);
    setStorage(KEYS.SHIFTS, filtered);

    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.from('shifts').delete().eq('id', shiftId);
      } catch (err) {
        console.warn('Error deleting shift from Supabase:', err);
      }
    }
  },

  async getShiftSchedules(filters?: {
    startDate?: string;
    endDate?: string;
    userId?: string;
  }): Promise<ShiftSchedule[]> {
    const localSchedules = getStorage<ShiftSchedule[]>(KEYS.SHIFT_SCHEDULES, []);
    const profiles = getStorage<Profile[]>(KEYS.PROFILES, SEED_USERS);
    const profileMap = new Map(profiles.map((p) => [p.id, p.full_name]));

    if (isSupabaseConfigured && supabase) {
      try {
        let query = supabase
          .from('shift_schedules')
          .select('*, profiles(full_name)')
          .order('schedule_date', { ascending: true })
          .order('start_time', { ascending: true });

        if (filters?.userId) {
          query = query.eq('user_id', filters.userId);
        }
        if (filters?.startDate) {
          query = query.gte('schedule_date', filters.startDate);
        }
        if (filters?.endDate) {
          query = query.lte('schedule_date', filters.endDate);
        }

        const { data, error } = await query;
        if (data && !error) {
          const mapped: ShiftSchedule[] = data.map((s: any) => ({
            id: s.id,
            business_id: s.business_id,
            user_id: s.user_id,
            user_name: s.profiles?.full_name || profileMap.get(s.user_id) || 'Staff',
            shift_name: s.shift_name,
            shift_type: s.shift_type,
            schedule_date: s.schedule_date,
            start_time: s.start_time,
            end_time: s.end_time,
            status: s.status,
            notes: s.notes,
            created_at: s.created_at,
            updated_at: s.updated_at,
          }));

          setStorage(KEYS.SHIFT_SCHEDULES, mapped);
          return mapped;
        }
      } catch (err) {
        console.warn('Error fetching shift schedules from Supabase:', err);
      }
    }

    let filtered = localSchedules.map((s) => ({
      ...s,
      user_name: profileMap.get(s.user_id) || 'Staff',
    }));

    if (filters?.userId) {
      filtered = filtered.filter((s) => s.user_id === filters.userId);
    }
    if (filters?.startDate) {
      filtered = filtered.filter((s) => s.schedule_date >= filters.startDate!);
    }
    if (filters?.endDate) {
      filtered = filtered.filter((s) => s.schedule_date <= filters.endDate!);
    }

    return filtered;
  },

  async createShiftSchedule(
    schedule: Omit<ShiftSchedule, 'id' | 'created_at' | 'updated_at'>
  ): Promise<ShiftSchedule> {
    const profiles = getStorage<Profile[]>(KEYS.PROFILES, SEED_USERS);
    const assignedUser = profiles.find((p) => p.id === schedule.user_id);
    const businessId = schedule.business_id || SEED_BUSINESS.id;

    const newSchedule: ShiftSchedule = {
      ...schedule,
      id: generateUUID(),
      business_id: businessId,
      user_name: assignedUser?.full_name || 'Staff',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const schedules = getStorage<ShiftSchedule[]>(KEYS.SHIFT_SCHEDULES, []);
    schedules.push(newSchedule);
    setStorage(KEYS.SHIFT_SCHEDULES, schedules);

    if (isSupabaseConfigured && supabase) {
      try {
        await ensureBusinessInSupabase(businessId);
        await supabase.from('shift_schedules').insert({
          id: newSchedule.id,
          business_id: businessId,
          user_id: newSchedule.user_id,
          shift_name: newSchedule.shift_name,
          shift_type: newSchedule.shift_type,
          schedule_date: newSchedule.schedule_date,
          start_time: newSchedule.start_time,
          end_time: newSchedule.end_time,
          status: newSchedule.status || 'scheduled',
          notes: newSchedule.notes || null,
        });
      } catch (err) {
        console.warn('Error inserting shift schedule into Supabase:', err);
      }
    }

    await auditLogsRepo.logAudit({
      action: 'CREATE_SHIFT_SCHEDULE',
      entity: 'SHIFT',
      entity_id: newSchedule.id,
      details: {
        staff: assignedUser?.full_name || schedule.user_id,
        shift: newSchedule.shift_name,
        date: newSchedule.schedule_date,
      },
    });

    return newSchedule;
  },

  async updateShiftSchedule(
    id: string,
    updates: Partial<ShiftSchedule>
  ): Promise<ShiftSchedule> {
    const schedules = getStorage<ShiftSchedule[]>(KEYS.SHIFT_SCHEDULES, []);
    const index = schedules.findIndex((s) => s.id === id);
    if (index !== -1) {
      const updated = {
        ...schedules[index],
        ...updates,
        updated_at: new Date().toISOString(),
      };
      schedules[index] = updated;
      setStorage(KEYS.SHIFT_SCHEDULES, schedules);
    }

    if (isSupabaseConfigured && supabase) {
      try {
        await supabase
          .from('shift_schedules')
          .update({
            ...updates,
            updated_at: new Date().toISOString(),
          })
          .eq('id', id);
      } catch (err) {
        console.warn('Error updating shift schedule in Supabase:', err);
      }
    }

    if (index !== -1) return schedules[index];
    throw new Error('Shift schedule not found');
  },

  async deleteShiftSchedule(id: string): Promise<void> {
    const schedules = getStorage<ShiftSchedule[]>(KEYS.SHIFT_SCHEDULES, []);
    const filtered = schedules.filter((s) => s.id !== id);
    setStorage(KEYS.SHIFT_SCHEDULES, filtered);

    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.from('shift_schedules').delete().eq('id', id);
      } catch (err) {
        console.warn('Error deleting shift schedule from Supabase:', err);
      }
    }

    await auditLogsRepo.logAudit({
      action: 'DELETE_SHIFT_SCHEDULE',
      entity: 'SHIFT',
      entity_id: id,
      details: { id },
    });
  },
};
