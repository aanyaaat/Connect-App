import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase, type Profile } from '@/lib/supabase';

interface AuthState {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  startWithDisplayName: (name: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string, name: string) => Promise<{ error: string | null }>;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  updateProfile: (patch: Partial<Profile>) => Promise<{ error: string | null }>;
}

const Ctx = createContext<AuthState | null>(null);

const DEVICE_ID_KEY = 'aanya_device_id';
const DISPLAY_NAME_KEY = 'aanya_saved_display_name';
const CACHED_USER_KEY = 'aanya_cached_user';
const CACHED_PROFILE_KEY = 'aanya_cached_profile';

function getOrCreateDeviceId(): string {
  let id = localStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
}

export function nameToDeterministicUuid(name: string): string {
  const clean = name.toLowerCase().trim().replace(/[\s_\-.]+/g, '');
  if (clean.startsWith('akh')) {
    return '00000000-0000-4000-8000-000000000001';
  }
  if (clean.startsWith('aany') || clean.startsWith('anya')) {
    return '00000000-0000-4000-8000-000000000002';
  }
  let hash = 0;
  for (let i = 0; i < clean.length; i++) {
    hash = ((hash << 5) - hash) + clean.charCodeAt(i);
    hash |= 0;
  }
  const hex = Math.abs(hash).toString(16).padStart(8, '0');
  return `00000000-0000-4000-8000-${hex.repeat(3).slice(0, 12)}`;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    try {
      const raw = localStorage.getItem(CACHED_USER_KEY);
      if (raw) return JSON.parse(raw);
      const savedName = localStorage.getItem(DISPLAY_NAME_KEY);
      if (savedName) {
        const uid = nameToDeterministicUuid(savedName);
        return {
          id: uid,
          app_metadata: {},
          user_metadata: { name: savedName },
          aud: 'authenticated',
          created_at: new Date().toISOString(),
        } as User;
      }
      return null;
    } catch {
      return null;
    }
  });
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(() => {
    try {
      const raw = localStorage.getItem(CACHED_PROFILE_KEY);
      if (raw) return JSON.parse(raw);
      const savedName = localStorage.getItem(DISPLAY_NAME_KEY);
      if (savedName) {
        const uid = nameToDeterministicUuid(savedName);
        return { id: uid, display_name: savedName, avatar_url: null, created_at: '', updated_at: '' };
      }
      return null;
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(() => !localStorage.getItem(DISPLAY_NAME_KEY) && !localStorage.getItem(CACHED_USER_KEY));

  const loadProfile = useCallback(async (uid: string, fallbackName?: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', uid)
        .maybeSingle();

      if (error) {
        console.warn('Profile fetch warning:', error.message);
      }

      if (!data) {
        const savedName = fallbackName || localStorage.getItem(DISPLAY_NAME_KEY) || 'You';
        const { data: created } = await supabase
          .from('profiles')
          .upsert({ id: uid, display_name: savedName })
          .select('*')
          .maybeSingle();
        if (created) {
          setProfile(created as Profile);
          localStorage.setItem(CACHED_PROFILE_KEY, JSON.stringify(created));
        }
      } else {
        setProfile(data as Profile);
        localStorage.setItem(CACHED_PROFILE_KEY, JSON.stringify(data));
      }
    } catch (e) {
      console.warn('loadProfile error:', e);
    }
  }, []);

  const initSession = useCallback(async () => {
    try {
      const savedName = localStorage.getItem(DISPLAY_NAME_KEY);
      if (savedName) {
        const uid = nameToDeterministicUuid(savedName);
        const userObj: User = {
          id: uid,
          app_metadata: {},
          user_metadata: { name: savedName },
          aud: 'authenticated',
          created_at: new Date().toISOString(),
        };
        setUser(userObj);
        localStorage.setItem(CACHED_USER_KEY, JSON.stringify(userObj));
        await loadProfile(uid, savedName);
      }
    } catch (e) {
      console.warn('Auth init warning:', e);
    } finally {
      setLoading(false);
    }
  }, [loadProfile]);

  useEffect(() => {
    initSession();
  }, [initSession]);

  // Pure 1-tap username sign-in (100% email-free, ZERO rate limits forever!)
  const startWithDisplayName = useCallback<AuthState['startWithDisplayName']>(async (name) => {
    const trimmed = name.trim() || 'You';
    localStorage.setItem(DISPLAY_NAME_KEY, trimmed);

    const uid = nameToDeterministicUuid(trimmed);
    const userObj: User = {
      id: uid,
      app_metadata: {},
      user_metadata: { name: trimmed },
      aud: 'authenticated',
      created_at: new Date().toISOString(),
    };

    setUser(userObj);
    localStorage.setItem(CACHED_USER_KEY, JSON.stringify(userObj));

    // Direct database upsert with 0 email calls
    try {
      await supabase.from('profiles').upsert({
        id: uid,
        display_name: trimmed,
      });
    } catch (e) {
      console.warn('Direct profile upsert error:', e);
    }

    await loadProfile(uid, trimmed);
    return { error: null };
  }, [loadProfile]);

  const signUp = useCallback<AuthState['signUp']>(async (_email, _password, name) => {
    return startWithDisplayName(name);
  }, [startWithDisplayName]);

  const signIn = useCallback<AuthState['signIn']>(async (_email, _password) => {
    return { error: null };
  }, []);

  const signOut = useCallback(async () => {
    localStorage.removeItem(DISPLAY_NAME_KEY);
    localStorage.removeItem(CACHED_USER_KEY);
    localStorage.removeItem(CACHED_PROFILE_KEY);
    localStorage.removeItem('aanya_onboarded');
    localStorage.removeItem('aanya_skipped_pair');
    setProfile(null);
    setUser(null);
    setSession(null);
  }, []);

  const refreshProfile = useCallback(async () => {
    if (user) await loadProfile(user.id);
  }, [user, loadProfile]);

  const updateProfile = useCallback<AuthState['updateProfile']>(
    async (patch) => {
      if (!user) return { error: 'Not signed in' };
      const { error } = await supabase.from('profiles').update(patch).eq('id', user.id);
      if (error) return { error: error.message };
      await refreshProfile();
      return { error: null };
    },
    [user, refreshProfile],
  );

  const value = useMemo<AuthState>(
    () => ({ user, session, profile, loading, startWithDisplayName, signUp, signIn, signOut, refreshProfile, updateProfile }),
    [user, session, profile, loading, startWithDisplayName, signUp, signIn, signOut, refreshProfile, updateProfile],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
