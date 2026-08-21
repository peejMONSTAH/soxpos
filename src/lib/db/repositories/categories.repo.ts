import { supabase, isSupabaseConfigured } from '@/lib/supabase/client';
import { Category } from '@/types/database.types';
import { SEED_BUSINESS, SEED_CATEGORIES } from '@/lib/seed-data';
import { KEYS, generateUUID, getStorage, setStorage, ensureBusinessInSupabase } from '../storage';
import { auditLogsRepo } from './audit-logs.repo';

export const categoriesRepo = {
  async getCategories(): Promise<Category[]> {
    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase
          .from('categories')
          .select('*')
          .order('name', { ascending: true });
        if (data && !error) {
          setStorage(KEYS.CATEGORIES, data as Category[]);
          return data as Category[];
        }
      } catch (err) {
        console.warn('Error loading categories from Supabase:', err);
      }
    }
    const localCats = getStorage<Category[]>(KEYS.CATEGORIES, []);
    return localCats;
  },

  async createCategory(
    category: Omit<Category, 'id' | 'created_at' | 'updated_at'>
  ): Promise<Category> {
    const businessId = category.business_id || SEED_BUSINESS.id;
    const newCat: Category = {
      ...category,
      business_id: businessId,
      id: generateUUID(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const cats = getStorage<Category[]>(KEYS.CATEGORIES, SEED_CATEGORIES);
    const existingIdx = cats.findIndex(
      (c) => c.id === newCat.id || c.name.toLowerCase() === newCat.name.toLowerCase()
    );
    if (existingIdx === -1) {
      cats.push(newCat);
    } else {
      cats[existingIdx] = newCat;
    }
    setStorage(KEYS.CATEGORIES, cats);

    if (isSupabaseConfigured && supabase) {
      try {
        await ensureBusinessInSupabase(businessId);
        const { data, error } = await supabase
          .from('categories')
          .insert({
            id: newCat.id,
            business_id: businessId,
            name: newCat.name,
            description: newCat.description || null,
            is_active: newCat.is_active ?? true,
            is_kitchen: newCat.is_kitchen ?? false,
          })
          .select()
          .single();

        if (data && !error) {
          return data as Category;
        }
      } catch (err) {
        console.warn('Supabase category error:', err);
      }
    }

    await auditLogsRepo.logAudit({
      action: 'CREATE_CATEGORY',
      entity: 'CATEGORY',
      entity_id: newCat.id,
      details: { name: newCat.name },
    });
    return newCat;
  },

  async updateCategory(id: string, updates: Partial<Category>): Promise<Category> {
    const cats = getStorage<Category[]>(KEYS.CATEGORIES, SEED_CATEGORIES);
    const index = cats.findIndex((c) => c.id === id);
    if (index !== -1) {
      cats[index] = { ...cats[index], ...updates, updated_at: new Date().toISOString() };
      setStorage(KEYS.CATEGORIES, cats);
    }

    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase
          .from('categories')
          .update({ ...updates, updated_at: new Date().toISOString() })
          .eq('id', id)
          .select()
          .single();
        if (data && !error) return data as Category;
      } catch (err) {
        console.warn('Error updating category in Supabase:', err);
      }
    }

    if (index !== -1) return cats[index];
    throw new Error('Category not found');
  },

  async deleteCategory(id: string): Promise<void> {
    const cats = getStorage<Category[]>(KEYS.CATEGORIES, SEED_CATEGORIES);
    const filtered = cats.filter((c) => c.id !== id);
    setStorage(KEYS.CATEGORIES, filtered);

    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.from('categories').delete().eq('id', id);
      } catch (err) {
        console.warn('Error deleting category from Supabase:', err);
      }
    }

    await auditLogsRepo.logAudit({
      action: 'DELETE_CATEGORY',
      entity: 'CATEGORY',
      entity_id: id,
    });
  },
};
