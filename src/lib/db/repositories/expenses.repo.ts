import { supabase, isSupabaseConfigured } from '@/lib/supabase/client';
import { Expense, ExpenseCategory } from '@/types/database.types';
import { SEED_BUSINESS } from '@/lib/seed-data';
import { KEYS, generateUUID, getStorage, setStorage, ensureBusinessInSupabase } from '../storage';
import { profilesRepo } from './profiles.repo';

export const expensesRepo = {
  async getExpenses(): Promise<Expense[]> {
    const localExpenses = getStorage<Expense[]>(KEYS.EXPENSES, []);
    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase
          .from('expenses')
          .select('*, profiles(full_name)')
          .order('date', { ascending: false });
        if (data && !error && data.length > 0) {
          const mapped = data.map((e: any) => ({
            ...e,
            created_by_name: e.profiles?.full_name || 'Staff',
          })) as Expense[];
          setStorage(KEYS.EXPENSES, mapped);
          return mapped;
        }
      } catch (err) {
        console.warn('Error fetching expenses from Supabase:', err);
      }
    }
    return localExpenses;
  },

  async createExpense(expense: {
    category: ExpenseCategory;
    description: string;
    amount: number;
    date: string;
    notes?: string;
    created_by?: string;
  }): Promise<Expense> {
    const user = await profilesRepo.getCurrentProfile();
    const newExpense: Expense = {
      id: generateUUID(),
      business_id: user?.business_id || SEED_BUSINESS.id,
      category: expense.category,
      description: expense.description,
      amount: expense.amount,
      date: expense.date,
      notes: expense.notes || null,
      created_by: expense.created_by || user?.id || null,
      created_at: new Date().toISOString(),
    };

    const expenses = getStorage<Expense[]>(KEYS.EXPENSES, []);
    expenses.unshift(newExpense);
    setStorage(KEYS.EXPENSES, expenses);

    if (isSupabaseConfigured && supabase) {
      try {
        await ensureBusinessInSupabase(newExpense.business_id);
        const isUUID = (val?: string | null) =>
          Boolean(val && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val));

        const expPayload: any = {
          id: newExpense.id,
          business_id: newExpense.business_id,
          category: newExpense.category,
          description: newExpense.description,
          amount: newExpense.amount,
          date: newExpense.date,
          notes: newExpense.notes || null,
          created_by: isUUID(newExpense.created_by) ? newExpense.created_by : null,
          created_at: newExpense.created_at,
        };

        let { error: expErr } = await supabase.from('expenses').insert(expPayload);
        if (expErr && expErr.message?.includes('created_by')) {
          expPayload.created_by = null;
          await supabase.from('expenses').insert(expPayload);
        }
      } catch (err) {
        console.warn('Error creating expense in Supabase:', err);
      }
    }

    return newExpense;
  },

  async updateExpense(id: string, updates: Partial<Expense>): Promise<Expense> {
    const expenses = getStorage<Expense[]>(KEYS.EXPENSES, []);
    const index = expenses.findIndex((e) => e.id === id);
    if (index !== -1) {
      expenses[index] = { ...expenses[index], ...updates };
      setStorage(KEYS.EXPENSES, expenses);
    }

    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase
          .from('expenses')
          .update(updates)
          .eq('id', id)
          .select()
          .single();
        if (data && !error) return data as Expense;
      } catch (err) {
        console.warn('Error updating expense in Supabase:', err);
      }
    }

    if (index !== -1) return expenses[index];
    throw new Error('Expense not found');
  },

  async deleteExpense(id: string): Promise<void> {
    const expenses = getStorage<Expense[]>(KEYS.EXPENSES, []);
    const filtered = expenses.filter((e) => e.id !== id);
    setStorage(KEYS.EXPENSES, filtered);

    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.from('expenses').delete().eq('id', id);
      } catch (err) {
        console.warn('Error deleting expense from Supabase:', err);
      }
    }
  },
};
