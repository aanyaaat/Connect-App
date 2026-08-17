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

function getNormalizedSlug(name: string): string {
  const clean = name.toLowerCase().trim().replace(/[\s_\-.]+/g, '');
  if (clean.startsWith('akh')) return 'akhil';
  if (clean.startsWith('aany') || clean.startsWith('anya')) return 'aanya';
  return clean.replace(/[^a-z0-9]/g, '').slice(0, 24) || 'user';
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    try {
      const raw = localStorage.getItem(CACHED_USER_KEY);
      return raw ? JSON.parse(raw) : null;
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
      if (savedName) return { id: 'cached', display_name: savedName, avatar_url: null, created_at: '', updated_at: '' };
      return null;
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(() => !localStorage.getItem(CACHED_USER_KEY) && !localStorage.getItem(DISPLAY_NAME_KEY));

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
      const { data } = await supabase.auth.getSession();
      if (data.session?.user) {
        setSession(data.session);
        setUser(data.session.user);
        localStorage.setItem(CACHED_USER_KEY, JSON.stringify(data.session.user));
        await loadProfile(data.session.user.id);
      } else {
        // Auto-reconnect saved profile on same device/network
        const savedName = localStorage.getItem(DISPLAY_NAME_KEY);
        if (savedName) {
          const slug = getNormalizedSlug(savedName);
          const email = `partner_${slug}@aanya.app`;
          const password = `aanya_pass_${slug}_2026!`;
          const { data: signInData } = await supabase.auth.signInWithPassword({ email, password });
          if (signInData.user) {
            setSession(signInData.session);
            setUser(signInData.user);
            localStorage.setItem(CACHED_USER_KEY, JSON.stringify(signInData.user));
            await loadProfile(signInData.user.id, savedName);
          }
        }
      }
    } catch (e) {
      console.warn('Auth init warning:', e);
    } finally {
      setLoading(false);
    }
  }, [loadProfile]);

  useEffect(() => {
    initSession();

    const { data: sub } = supabase.auth.onAuthStateChange((event, sess) => {
      setSession(sess);
      setUser(sess?.user ?? null);
      if (sess?.user) {
        localStorage.setItem(CACHED_USER_KEY, JSON.stringify(sess.user));
        loadProfile(sess.user.id);
      } else if (event === 'SIGNED_OUT') {
        setProfile(null);
        localStorage.removeItem(CACHED_USER_KEY);
        localStorage.removeItem(CACHED_PROFILE_KEY);
      }
      setLoading(false);
    });

    return () => sub.subscription.unsubscribe();
  }, [initSession, loadProfile]);

  // Deterministic 1-tap sign-in: Same name logs into same profile on any device (ZERO emails sent!)
  const startWithDisplayName = useCallback<AuthState['startWithDisplayName']>(async (name) => {
    const trimmed = name.trim() || 'You';
    localStorage.setItem(DISPLAY_NAME_KEY, trimmed);

    const slug = getNormalizedSlug(trimmed);
    const email = `partner_${slug}@aanya.app`;
    const password = `aanya_pass_${slug}_2026!`;

    let userObj: User | null = null;
    let sessionObj: Session | null = null;

    // 1. Try signing in directly to existing unified account
    const { data: signInRes, error: signInErr } = await supabase.auth.signInWithPassword({ email, password });
    if (!signInErr && signInRes?.user) {
      userObj = signInRes.user;
      sessionObj = signInRes.session;
    } else {
      // 2. If account doesn't exist yet, create it once (bypasses email limits completely)
      const { data: signUpRes, error: signUpErr } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { name: trimmed },
        },
      });

      if (!signUpErr && signUpRes?.user) {
        userObj = signUpRes.user;
        sessionObj = signUpRes.session;
      } else if (signUpErr) {
        // Fallback: If signup reported existing user, try sign-in again
        const { data: retryRes } = await supabase.auth.signInWithPassword({ email, password });
        if (retryRes?.user) {
          userObj = retryRes.user;
          sessionObj = retryRes.session;
        } else {
          return { error: signUpErr.message };
        }
      }
    }

    if (userObj) {
      setUser(userObj);
      setSession(sessionObj);
      localStorage.setItem(CACHED_USER_KEY, JSON.stringify(userObj));
      await supabase.from('profiles').upsert({
        id: userObj.id,
        display_name: trimmed,
      });
      await loadProfile(userObj.id, trimmed);
    }

    return { error: null };
  }, [loadProfile]);

  const signUp = useCallback<AuthState['signUp']>(async (email, password, name) => {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) return { error: error.message };
    if (data.user) {
      await supabase.from('profiles').upsert({
        id: data.user.id,
        display_name: name || 'You',
      });
    }
    return { error: null };
  }, []);

  const signIn = useCallback<AuthState['signIn']>(async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    localStorage.removeItem(DISPLAY_NAME_KEY);
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
