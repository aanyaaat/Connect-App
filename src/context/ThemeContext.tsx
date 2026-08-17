import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { AccentKey } from '@/lib/supabase';
import { useAuth } from './AuthContext';

type ThemeMode = 'light' | 'dark' | 'system';

interface ThemeState {
  mode: ThemeMode;
  accent: AccentKey;
  setMode: (m: ThemeMode) => void;
  setAccent: (a: AccentKey) => void;
  resolvedDark: boolean;
}

const Ctx = createContext<ThemeState | null>(null);

const ACCENTS: Record<AccentKey, { light: string; dark: string; softLight: string; softDark: string }> = {
  rose: { light: '159 18 57', dark: '244 114 182', softLight: '252 228 230', softDark: '67 38 50' },
  burgundy: { light: '127 29 29', dark: '251 113 133', softLight: '245 224 224', softDark: '60 30 32' },
  lavender: { light: '109 40 100', dark: '216 180 254', softLight: '243 224 255', softDark: '50 36 60' },
  sage: { light: '63 98 18', dark: '134 239 172', softLight: '227 240 215', softDark: '30 48 30' },
  amber: { light: '180 83 9', dark: '252 211 77', softLight: '253 230 138', softDark: '58 42 24' },
  ocean: { light: '12 74 110', dark: '96 165 250', softLight: '219 234 254', softDark: '24 40 64' },
};

function applyTheme(mode: ThemeMode, accent: AccentKey) {
  const root = document.documentElement;
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const dark = mode === 'dark' || (mode === 'system' && prefersDark);
  root.classList.toggle('dark', dark);
  const a = ACCENTS[accent];
  const rs = root.style;
  rs.setProperty('--accent', dark ? a.dark : a.light);
  rs.setProperty('--accent-soft', dark ? a.softDark : a.softLight);
  rs.setProperty('--accent-fg', dark ? '30 18 22' : '255 255 255');
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', dark ? '#1a1416' : '#fbf7f4');
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { profile, updateProfile } = useAuth();
  const [mode, setModeState] = useState<ThemeMode>(
    () => (localStorage.getItem('aanya_theme') as ThemeMode) || 'system',
  );
  const [accent, setAccentState] = useState<AccentKey>(
    () => (localStorage.getItem('aanya_accent') as AccentKey) || 'rose',
  );
  const [resolvedDark, setResolvedDark] = useState(false);

  useEffect(() => {
    if (profile?.theme) setModeState(profile.theme);
    if (profile?.accent) setAccentState(profile.accent);
  }, [profile]);

  useEffect(() => {
    applyTheme(mode, accent);
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => {
      applyTheme(mode, accent);
      setResolvedDark(mq.matches);
    };
    mq.addEventListener('change', handler);
    setResolvedDark(mq.matches);
    return () => mq.removeEventListener('change', handler);
  }, [mode, accent]);

  const setMode = useCallback((m: ThemeMode) => {
    setModeState(m);
    localStorage.setItem('aanya_theme', m);
    if (profile) updateProfile({ theme: m });
  }, [profile, updateProfile]);

  const setAccent = useCallback((a: AccentKey) => {
    setAccentState(a);
    localStorage.setItem('aanya_accent', a);
    if (profile) updateProfile({ accent: a });
  }, [profile, updateProfile]);

  const value = useMemo<ThemeState>(
    () => ({ mode, accent, setMode, setAccent, resolvedDark }),
    [mode, accent, setMode, setAccent, resolvedDark],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTheme(): ThemeState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
