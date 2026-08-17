import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const isSupabaseConfigured = Boolean(
  url &&
  anon &&
  url !== 'https://your-project-id.supabase.co' &&
  !url.includes('placeholder')
);

if (!isSupabaseConfigured) {
  console.warn(
    'Supabase credentials missing or using placeholders. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file.'
  );
}

export const supabase = createClient(
  url && url.startsWith('http') ? url : 'https://placeholder.supabase.co',
  anon || 'placeholder-anon-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  }
);

export type EventType =
  | 'READY'
  | 'CUSTOM'
  | 'ARRIVED'
  | 'DEPARTED'
  | 'SOS'
  | 'SLEEPING'
  | 'CALL_ME'
  | 'THINKING'
  | 'DND'
  | 'AVAILABLE'
  | 'HOME';

export type DeliveryStatus = 'queued' | 'sent' | 'acked';

export interface Profile {
  id: string;
  display_name: string;
  avatar_color: string;
  fcm_token: string | null;
  theme: 'light' | 'dark' | 'system';
  accent: AccentKey;
  location_mode: 'off' | 'arrival' | 'sos' | 'live';
  created_at: string;
}

export interface Connection {
  id: string;
  pairing_code: string;
  user_a: string;
  user_b: string | null;
  status: 'pending' | 'accepted' | 'severed';
  created_at: string;
  accepted_at: string | null;
}

export interface Place {
  id: string;
  owner_id: string;
  name: string;
  emoji: string;
  latitude: number | null;
  longitude: number | null;
  radius: number;
  dwell_minutes: number;
  arrival_enabled: boolean;
  departure_enabled: boolean;
  arrival_message: string | null;
  departure_message: string | null;
  created_at: string;
}

export interface QuickMessage {
  id: string;
  owner_id: string;
  emoji: string;
  label: string;
  message: string;
  pinned: boolean;
  sort_order: number;
  created_at: string;
}

export interface AppEvent {
  id: string;
  connection_id: string;
  sender_id: string;
  type: EventType;
  message: string;
  emoji: string;
  occurred_at: string;
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
  place_id: string | null;
  delivery_status: DeliveryStatus;
  created_offline: boolean;
  keep_forever?: boolean;
  synced_at: string | null;
  created_at: string;
}

export type AccentKey = 'rose' | 'burgundy' | 'lavender' | 'sage' | 'amber' | 'ocean';
