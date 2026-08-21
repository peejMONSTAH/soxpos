import { supabase, isSupabaseConfigured } from '@/lib/supabase/client';
import { Profile, UserRole } from '@/types/database.types';
import { SEED_USERS } from '@/lib/seed-data';
import { KEYS, generateUUID, getStorage, setStorage, ensureBusinessInSupabase } from '../storage';
import { auditLogsRepo } from './audit-logs.repo';

export const profilesRepo = {
  async getProfiles(): Promise<Profile[]> {
    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .order('created_at', { ascending: true });
        if (!error && data !== null) {
          // Cloud Supabase is the EXCLUSIVE source of truth
          setStorage(KEYS.PROFILES, data as Profile[]);
          return data as Profile[];
        }
      } catch (err) {
        console.warn('Error fetching profiles from Supabase:', err);
      }
    }

    return getStorage<Profile[]>(KEYS.PROFILES, []);
  },

  async getCurrentProfile(): Promise<Profile> {
    const saved = getStorage<Profile | null>(KEYS.CURRENT_USER, null);
    if (saved) return saved;
    const profiles = await this.getProfiles();
    return profiles[0] || SEED_USERS[0];
  },

  async setCurrentProfile(profile: Profile): Promise<void> {
    setStorage(KEYS.CURRENT_USER, profile);
  },

  async switchProfile(role: UserRole): Promise<Profile> {
    const profiles = await this.getProfiles();
    const target = profiles.find((p) => p.role === role) || profiles[0];
    await this.setCurrentProfile(target);
    return target;
  },

  async createProfile(
    profile: Omit<Profile, 'id' | 'created_at' | 'updated_at'>
  ): Promise<Profile> {
    const newProfile: Profile = {
      ...profile,
      id: generateUUID(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const profiles = getStorage<Profile[]>(KEYS.PROFILES, SEED_USERS);
    profiles.push(newProfile);
    setStorage(KEYS.PROFILES, profiles);

    if (isSupabaseConfigured && supabase) {
      try {
        await ensureBusinessInSupabase(newProfile.business_id);
        const { data, error } = await supabase
          .from('profiles')
          .insert(newProfile)
          .select()
          .single();
        if (data && !error) return data as Profile;
      } catch (err) {
        console.warn('Error creating profile in Supabase:', err);
      }
    }

    await auditLogsRepo.logAudit({
      action: 'CREATE_STAFF',
      entity: 'PROFILE',
      entity_id: newProfile.id,
      details: { name: newProfile.full_name, role: newProfile.role },
    });
    return newProfile;
  },

  async updateProfile(id: string, updates: Partial<Profile>): Promise<Profile> {
    const profiles = getStorage<Profile[]>(KEYS.PROFILES, SEED_USERS);
    const index = profiles.findIndex((p) => p.id === id);
    if (index !== -1) {
      profiles[index] = { ...profiles[index], ...updates, updated_at: new Date().toISOString() };
      setStorage(KEYS.PROFILES, profiles);
    }

    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .update({ ...updates, updated_at: new Date().toISOString() })
          .eq('id', id)
          .select()
          .single();
        if (data && !error) return data as Profile;
      } catch (err) {
        console.warn('Error updating profile in Supabase:', err);
      }
    }

    if (index !== -1) return profiles[index];
    throw new Error('Profile not found');
  },

  async deleteProfile(id: string): Promise<void> {
    const profiles = getStorage<Profile[]>(KEYS.PROFILES, SEED_USERS);
    const target = profiles.find((p) => p.id === id);
    const filtered = profiles.filter((p) => p.id !== id);
    setStorage(KEYS.PROFILES, filtered);

    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.from('profiles').delete().eq('id', id);
      } catch (err) {
        console.warn('Error deleting profile from Supabase:', err);
      }
    }

    await auditLogsRepo.logAudit({
      action: 'DELETE_STAFF',
      entity: 'PROFILE',
      entity_id: id,
      details: { name: target?.full_name || id },
    });
  },
};

