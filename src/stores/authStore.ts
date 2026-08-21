import { create } from 'zustand';
import { Profile, UserRole } from '@/types/database.types';
import { dbService, initializeLocalDatabase } from '@/lib/db';
import { supabase, isSupabaseConfigured } from '@/lib/supabase/client';
import { SEED_USERS } from '@/lib/seed-data';
import { generateUUID } from '@/lib/db/storage';

interface AuthState {
  user: Profile | null;
  isLoading: boolean;
  isInitialized: boolean;
  role: UserRole;
  initialize: () => Promise<void>;
  signInWithEmail: (email: string, pass: string) => Promise<void>;
  signUpWithEmail: (email: string, pass: string, fullName?: string) => Promise<void>;
  switchUser: (role: UserRole) => Promise<void>;
  switchUserWithPin: (profileId: string, pin: string) => Promise<{ success: boolean; message?: string }>;
  updateUserPin: (profileId: string, newPin: string) => Promise<void>;
  setUser: (user: Profile) => void;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isLoading: true,
  isInitialized: false,
  role: 'owner',

  initialize: async () => {
    if (get().isInitialized) return;
    set({ isInitialized: true });
    initializeLocalDatabase();
    
    // Check live Supabase session
    if (isSupabaseConfigured && supabase) {
      try {
        // Sync profiles from Supabase immediately and purge stale cache
        const { data: cloudProfiles } = await supabase.from('profiles').select('*').order('created_at', { ascending: true });
        if (cloudProfiles) {
          localStorage.setItem('pos_db_profiles', JSON.stringify(cloudProfiles));
        }

        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          // Check if profile already exists in Supabase
          const { data: existingProfile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .maybeSingle();

          let profile: Profile;
          if (existingProfile) {
            profile = existingProfile as Profile;
          } else {
            const ownerName = session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || 'Store Owner';
            profile = {
              id: session.user.id,
              business_id: 'b0000000-0000-0000-0000-000000000001',
              role: 'owner',
              full_name: ownerName,
              avatar_url: null,
              phone: session.user.phone || null,
              pin_code: '1234',
              status: 'active',
              created_at: session.user.created_at,
              updated_at: new Date().toISOString(),
            };

            try {
              await supabase.from('profiles').upsert(
                {
                  id: profile.id,
                  business_id: profile.business_id,
                  role: 'owner',
                  full_name: profile.full_name,
                  phone: profile.phone,
                  pin_code: profile.pin_code || '1234',
                  status: 'active',
                },
                { onConflict: 'id' }
              );
            } catch (syncErr) {
              console.warn('Auto-sync owner profile warning:', syncErr);
            }
          }

          set({ user: profile, role: profile.role, isLoading: false });
          return;
        }

        // Set up live auth listener
        supabase.auth.onAuthStateChange(async (_event, session) => {
          if (session?.user && supabase) {
            const { data: existingProfile } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', session.user.id)
              .maybeSingle();

            let profile: Profile;
            if (existingProfile) {
              profile = existingProfile as Profile;
            } else {
              const ownerName = session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || 'Store Owner';
              profile = {
                id: session.user.id,
                business_id: 'b0000000-0000-0000-0000-000000000001',
                role: 'owner',
                full_name: ownerName,
                avatar_url: null,
                phone: session.user.phone || null,
                pin_code: '1234',
                status: 'active',
                created_at: session.user.created_at,
                updated_at: new Date().toISOString(),
              };

              try {
                await supabase.from('profiles').upsert(
                  {
                    id: profile.id,
                    business_id: profile.business_id,
                    role: 'owner',
                    full_name: profile.full_name,
                    phone: profile.phone,
                    pin_code: profile.pin_code || '1234',
                    status: 'active',
                  },
                  { onConflict: 'id' }
                );
              } catch (syncErr) {
                console.warn('Live owner profile sync warning:', syncErr);
              }
            }

            set({ user: profile, role: profile.role, isLoading: false });
          } else {
            set({ user: null, isLoading: false });
          }
        });

        // No active session found on Supabase
        set({ user: null, isLoading: false });
        return;
      } catch (err) {
        console.error('Error checking Supabase auth session:', err);
        set({ user: null, isLoading: false });
        return;
      }
    }

    try {
      const user = await dbService.getCurrentProfile();
      if (!get().user && user) {
        set({ user, role: user.role, isLoading: false });
      }
    } catch {
      if (!get().user) {
        set({ user: null, isLoading: false });
      }
    }
  },

  signInWithEmail: async (email: string, pass: string) => {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: pass,
      });

      if (error) {
        throw error;
      }

      if (data.user) {
        const { data: existingProfile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', data.user.id)
          .maybeSingle();

        let profile: Profile;
        if (existingProfile) {
          profile = existingProfile as Profile;
        } else {
          const ownerName = data.user.user_metadata?.full_name || email.split('@')[0] || 'Store Owner';
          profile = {
            id: data.user.id,
            business_id: 'b0000000-0000-0000-0000-000000000001',
            role: 'owner',
            full_name: ownerName,
            avatar_url: null,
            phone: data.user.phone || null,
            pin_code: '1234',
            status: 'active',
            created_at: data.user.created_at,
            updated_at: new Date().toISOString(),
          };

          try {
            await supabase.from('profiles').upsert(
              {
                id: profile.id,
                business_id: profile.business_id,
                role: 'owner',
                full_name: profile.full_name,
                phone: profile.phone,
                pin_code: profile.pin_code || '1234',
                status: 'active',
              },
              { onConflict: 'id' }
            );
          } catch (syncErr) {
            console.warn('Sign-in owner profile upsert warning:', syncErr);
          }
        }

        set({ user: profile, role: profile.role });
      }
    } else {
      const user: Profile = {
        id: generateUUID(),
        business_id: 'b0000000-0000-0000-0000-000000000001',
        role: 'owner',
        full_name: email.split('@')[0] || 'Store Owner',
        avatar_url: null,
        phone: null,
        status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      await dbService.setCurrentProfile(user);
      set({ user, role: 'owner' });
    }
  },

  signUpWithEmail: async (email: string, pass: string, fullName?: string) => {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password: pass,
        options: {
          data: {
            full_name: fullName || email.split('@')[0],
            role: 'owner',
          },
        },
      });
      if (error) throw error;
      if (data.user) {
        const profile: Profile = {
          id: data.user.id,
          business_id: 'b0000000-0000-0000-0000-000000000001',
          role: 'owner',
          full_name: fullName || email.split('@')[0] || 'Store Owner',
          avatar_url: null,
          phone: null,
          status: 'active',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        set({ user: profile, role: 'owner' });
      }
    } else {
      const user: Profile = {
        id: generateUUID(),
        business_id: 'b0000000-0000-0000-0000-000000000001',
        role: 'owner',
        full_name: fullName || email.split('@')[0] || 'Store Owner',
        avatar_url: null,
        phone: null,
        status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      await dbService.setCurrentProfile(user);
      set({ user, role: 'owner' });
    }
  },

  switchUser: async (role: UserRole) => {
    const profiles = await dbService.getProfiles();
    const target = profiles.find((p) => p.role === role) || (role === 'owner' ? SEED_USERS[0] : SEED_USERS[0]);
    await dbService.setCurrentProfile(target);
    set({ user: target, role: target.role });
  },

  switchUserWithPin: async (profileId: string, pin: string) => {
    // Check lockout
    const lockoutKey = `pin_lockout_${profileId}`;
    const attemptsKey = `pin_attempts_${profileId}`;
    
    if (typeof window !== 'undefined') {
      const lockoutUntil = parseInt(localStorage.getItem(lockoutKey) || '0', 10);
      const now = Date.now();
      if (lockoutUntil > now) {
        const remainingSec = Math.ceil((lockoutUntil - now) / 1000);
        return { 
          success: false, 
          message: `Too many failed attempts. Account locked for ${remainingSec}s.` 
        };
      }
    }

    const profiles = await dbService.getProfiles();
    const target = profiles.find((p) => p.id === profileId);
    if (!target) {
      return { success: false, message: 'User profile not found.' };
    }

    // Verify PIN
    const validPin = target.pin_code || (target.role === 'owner' ? '1234' : '1111');
    if (validPin !== pin.trim()) {
      if (typeof window !== 'undefined') {
        const attempts = parseInt(localStorage.getItem(attemptsKey) || '0', 10) + 1;
        if (attempts >= 5) {
          // Lock for 30 seconds
          localStorage.setItem(lockoutKey, (Date.now() + 30000).toString());
          localStorage.removeItem(attemptsKey);
          return {
            success: false,
            message: '5 incorrect attempts. Account locked for 30 seconds.',
          };
        } else {
          localStorage.setItem(attemptsKey, attempts.toString());
          return {
            success: false,
            message: `Incorrect 4-digit PIN (${5 - attempts} attempts remaining).`,
          };
        }
      }
      return { success: false, message: 'Incorrect 4-digit PIN. Please try again.' };
    }

    // Success - reset attempts
    if (typeof window !== 'undefined') {
      localStorage.removeItem(attemptsKey);
      localStorage.removeItem(lockoutKey);
    }

    await dbService.setCurrentProfile(target);
    set({ user: target, role: target.role });
    return { success: true };
  },

  updateUserPin: async (profileId: string, newPin: string) => {
    const updated = await dbService.updateProfile(profileId, { pin_code: newPin.trim() });
    if (get().user?.id === profileId) {
      set({ user: updated });
    }
  },

  setUser: (user: Profile) => {
    dbService.setCurrentProfile(user);
    set({ user, role: user.role });
  },

  logout: async () => {
    if (isSupabaseConfigured && supabase) {
      await supabase.auth.signOut();
    }
    set({ user: null });
  },
}));
