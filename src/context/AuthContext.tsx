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

function getOrCreateDeviceId(): string {
  let id = localStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

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
        if (created) setProfile(created as Profile);
      } else {
        setProfile(data as Profile);
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
        await loadProfile(data.session.user.id);
      } else {
        // Check if device already has a saved account
        const devId = localStorage.getItem(DEVICE_ID_KEY);
        const savedName = localStorage.getItem(DISPLAY_NAME_KEY);
        if (devId && savedName) {
          const email = `device_${devId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 16)}@aanya.app`;
          const password = `pass_${devId.slice(0, 18)}`;
          const { data: signInData } = await supabase.auth.signInWithPassword({ email, password });
          if (signInData.user) {
            setSession(signInData.session);
            setUser(signInData.user);
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
        loadProfile(sess.user.id);
      } else if (event === 'SIGNED_OUT') {
        setProfile(null);
      }
      setLoading(false);
    });

    return () => sub.subscription.unsubscribe();
  }, [initSession, loadProfile]);

  // Instant 1-tap frictionless sign-in with display name (No email confirmation needed!)
  const startWithDisplayName = useCallback<AuthState['startWithDisplayName']>(async (name) => {
    const trimmed = name.trim() || 'You';
    localStorage.setItem(DISPLAY_NAME_KEY, trimmed);
    const devId = getOrCreateDeviceId();
    const email = `device_${devId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 16)}@aanya.app`;
    const password = `pass_${devId.slice(0, 18)}`;

    // Try signing in first
    let userObj: User | null = null;
    let sessionObj: Session | null = null;

    const { data: signInRes, error: signInErr } = await supabase.auth.signInWithPassword({ email, password });

    if (signInErr || !signInRes.user) {
      // If not exists, sign up immediately
      const { data: signUpRes, error: signUpErr } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { name: trimmed },
        },
      });

      if (signUpErr) {
        return { error: signUpErr.message };
      }
      userObj = signUpRes.user;
      sessionObj = signUpRes.session;
    } else {
      userObj = signInRes.user;
      sessionObj = signInRes.session;
    }

    if (userObj) {
      setUser(userObj);
      setSession(sessionObj);
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
