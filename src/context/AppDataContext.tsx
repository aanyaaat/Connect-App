import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { supabase, type AppEvent, type Connection, type Place, type QuickMessage, type EventType, type EphemeralStatus } from '@/lib/supabase';
import { useAuth } from './AuthContext';
import { enqueue, loadQueue, removeFromQueue, saveQueue, type QueuedEvent } from '@/lib/queue';
import { generatePairingCode } from '@/lib/format';
import { showLocalNotification, initializeNotificationSystem, dispatchPushToPartner } from '@/lib/notifications';
import { getCurrentPosition, watchPosition, type Coords } from '@/lib/location';
import { evaluateArrival, loadArrivalStates, saveArrivalStates } from '@/lib/arrival';
import { initBatteryMonitoring } from '@/lib/battery';

interface SendInput {
  type: EventType;
  message: string;
  emoji: string;
  placeId?: string | null;
  attachLocation?: boolean;
}

interface AppDataState {
  connection: Connection | null;
  partnerId: string | null;
  partnerName: string;
  partnerProfile: { id: string; display_name: string; battery_level?: number | null; is_charging?: boolean | null } | null;
  events: AppEvent[];
  places: Place[];
  quickMessages: QuickMessage[];
  ephemeralStatuses: EphemeralStatus[];
  partnerStatus: EphemeralStatus | null;
  myStatus: EphemeralStatus | null;
  uploadEphemeralStatus: (type: 'PHOTO' | 'VIDEO' | 'VOICE', mediaUrl: string, caption?: string, duration?: number) => Promise<{ ok: boolean; error?: string }>;
  deleteEphemeralStatus: (id: string) => Promise<void>;
  refreshEphemeralStatuses: () => Promise<void>;
  online: boolean;
  queueCount: number;
  lastEvent: AppEvent | null;
  partnerLastEvent: AppEvent | null;
  myLastEvent: AppEvent | null;
  sending: boolean;
  send: (input: SendInput) => Promise<{ ok: boolean; offline: boolean; error?: string }>;
  createConnection: () => Promise<{ code: string | null; error?: string }>;
  joinConnection: (code: string) => Promise<{ ok: boolean; error?: string }>;
  disconnect: () => Promise<{ ok: boolean; error?: string }>;
  refreshPlaces: () => Promise<void>;
  refreshQuickMessages: () => Promise<void>;
  addPlace: (p: Omit<Place, 'id' | 'owner_id' | 'created_at'>) => Promise<{ ok: boolean; error?: string }>;
  updatePlace: (id: string, patch: Partial<Place>) => Promise<{ ok: boolean; error?: string }>;
  deletePlace: (id: string) => Promise<{ ok: boolean; error?: string }>;
  addQuickMessage: (m: Omit<QuickMessage, 'id' | 'owner_id' | 'created_at' | 'sort_order'>) => Promise<{ ok: boolean; error?: string }>;
  updateQuickMessage: (id: string, patch: Partial<QuickMessage>) => Promise<{ ok: boolean; error?: string }>;
  deleteQuickMessage: (id: string) => Promise<{ ok: boolean; error?: string }>;
  reorderQuickMessages: (orderedIds: string[]) => Promise<void>;
  ackEvent: (id: string) => Promise<void>;
  deleteEvent: (id: string) => Promise<{ ok: boolean; error?: string }>;
  toggleKeepForever: (id: string) => Promise<void>;
  cleanupOldEvents: (daysToKeep?: number) => Promise<{ count: number; error?: string }>;
  retentionDays: number;
  setRetentionDays: (days: number) => void;
  storageStats: {
    eventCount: number;
    keptCount: number;
    estimatedKB: number;
    quotaPercent: number;
  };
  arrivalDiagnostics: { status: 'working' | 'disabled' | 'no-places' | 'no-permission'; detail: string };
}

const Ctx = createContext<AppDataState | null>(null);

const uuid = () => crypto.randomUUID();

export function AppDataProvider({ children }: { children: ReactNode }) {
  const { user, profile, refreshProfile } = useAuth();
  const [connection, setConnection] = useState<Connection | null>(() => {
    try {
      const cached = localStorage.getItem('aanya_cached_connection');
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  });
  const [events, setEvents] = useState<AppEvent[]>([]);
  const [places, setPlaces] = useState<Place[]>([]);
  const [quickMessages, setQuickMessages] = useState<QuickMessage[]>([]);
  const [online, setOnline] = useState(navigator.onLine);
  const [queueCount, setQueueCount] = useState(0);
  const [sending, setSending] = useState(false);
  const [partnerProfile, setPartnerProfile] = useState<{ id: string; display_name: string } | null>(() => {
    try {
      const cached = localStorage.getItem('aanya_cached_partner_profile');
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  });
  const [coords, setCoords] = useState<Coords | null>(null);
  const [retentionDays, setRetentionDaysState] = useState<number>(() => {
    const saved = localStorage.getItem('aanya_retention_days');
    return saved !== null ? Number(saved) : 30; // default 30 days
  });
  const [arrivalDiagnostics, setArrivalDiagnostics] = useState<AppDataState['arrivalDiagnostics']>({
    status: 'no-places',
    detail: 'No saved places with arrival detection enabled.',
  });
  const watchedRef = useRef(false);
  const realtimeEventsChannelRef = useRef<any>(null);

  const partnerId = connection
    ? connection.user_a === user?.id
      ? connection.user_b
      : connection.user_a
    : null;
  const partnerName = partnerProfile?.display_name ?? 'Aanya';

  // ---- online/offline
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  // Sync connection state with partner
  const loadConnection = useCallback(async () => {
    if (!user) {
      setConnection(null);
      localStorage.removeItem('aanya_cached_connection');
      return;
    }
    const { data } = await supabase
      .from('connections')
      .select('*')
      .or(`user_a.eq.${user.id},user_b.eq.${user.id}`)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (data) {
      const conn = data as Connection;
      setConnection(conn);
      localStorage.setItem('aanya_cached_connection', JSON.stringify(conn));
      if (conn.pairing_code) {
        localStorage.setItem('aanya_active_code', conn.pairing_code);
      }
    }
  }, [user]);

  useEffect(() => {
    loadConnection();
  }, [user, loadConnection]);

  // Sync config to Android Native 24/7 Background Heartbeat Service
  useEffect(() => {
    if (user?.id && connection?.id) {
      try {
        if (typeof (window as any).AndroidNativeConfig?.saveConfig === 'function') {
          (window as any).AndroidNativeConfig.saveConfig(user.id, connection.id, partnerName);
        }
      } catch {
        // ignore on web
      }
    }
  }, [user?.id, connection?.id, partnerName]);

  // Pure WebSockets: Realtime bidirectional channel for instant sub-50ms connection updates
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`connections_user_${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'connections' },
        (payload) => {
          const c = payload.new as Connection;
          if (c && (c.user_a === user.id || c.user_b === user.id)) {
            setConnection(c);
            localStorage.setItem('aanya_cached_connection', JSON.stringify(c));
            if (c.pairing_code) localStorage.setItem('aanya_active_code', c.pairing_code);
          }
        },
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          loadConnection();
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, loadConnection]);

  interface PartnerProfile {
    id: string;
    display_name: string;
    battery_level?: number | null;
    is_charging?: boolean | null;
  }

  // ---- load partner profile & live battery updates
  useEffect(() => {
    if (!partnerId) {
      setPartnerProfile(null);
      localStorage.removeItem('aanya_cached_partner_profile');
      return;
    }
    const fetchPartner = () => {
      supabase
        .from('profiles')
        .select('id, display_name, battery_level, is_charging')
        .eq('id', partnerId)
        .maybeSingle()
        .then(({ data }) => {
          if (data) {
            const p = data as PartnerProfile;
            setPartnerProfile(p);
            localStorage.setItem('aanya_cached_partner_profile', JSON.stringify(p));
          }
        });
    };

    fetchPartner();

    // Listen for live battery and profile changes
    const profileChannel = supabase
      .channel(`partner_profile_${partnerId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${partnerId}` },
        (payload) => {
          if (payload.new) {
            const p = payload.new as PartnerProfile;
            setPartnerProfile(p);
            localStorage.setItem('aanya_cached_partner_profile', JSON.stringify(p));
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(profileChannel);
    };
  }, [partnerId]);

  // ---- load events
  const loadEvents = useCallback(async () => {
    if (!connection || connection.status !== 'accepted') {
      setEvents([]);
      return;
    }
    const { data } = await supabase
      .from('events')
      .select('*')
      .eq('connection_id', connection.id)
      .order('occurred_at', { ascending: false })
      .limit(200);
    setEvents((data as AppEvent[]) ?? []);
  }, [connection]);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  const notifiedEventIdsRef = useRef<Set<string>>(new Set());

  const triggerNotificationOnce = useCallback((ev: AppEvent) => {
    if (!ev || ev.sender_id === user?.id) return;
    if (notifiedEventIdsRef.current.has(ev.id)) return;
    notifiedEventIdsRef.current.add(ev.id);
    showLocalNotification({
      title: `${ev.emoji} ${partnerName}`,
      body: ev.message,
      tag: ev.id,
    });
  }, [user?.id, partnerName]);

  // ---- High-Speed Realtime: Instant WebSockets Broadcast (<30ms) + PostgreSQL WAL Persistence
  useEffect(() => {
    if (!connection || connection.status !== 'accepted') return;
    const channel = supabase
      .channel(`events:${connection.id}`, {
        config: {
          broadcast: { self: false },
        },
      })
      .on('broadcast', { event: 'instant_message' }, (payload) => {
        const ev = payload.payload as AppEvent;
        if (!ev) return;
        setEvents((prev) => (prev.some((e) => e.id === ev.id) ? prev : [ev, ...prev]));
        triggerNotificationOnce(ev);
      })
      .on('broadcast', { event: 'new_ephemeral_status' }, (payload) => {
        const st = payload.payload as EphemeralStatus;
        if (!st) return;
        setEphemeralStatuses((prev) => [st, ...prev.filter((s) => s.user_id !== st.user_id)]);
        if (st.user_id !== user?.id) {
          showLocalNotification({
            title: `${partnerName} posted a Glance ❤️`,
            body: `Tap to view the 1-hour moment`,
            tag: `status_${st.id}`,
          });
        }
      })
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'events', filter: `connection_id=eq.${connection.id}` },
        (payload) => {
          const ev = payload.new as AppEvent;
          setEvents((prev) => (prev.some((e) => e.id === ev.id) ? prev : [ev, ...prev]));
          triggerNotificationOnce(ev);
        },
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'events', filter: `connection_id=eq.${connection.id}` },
        (payload) => {
          const ev = payload.new as AppEvent;
          setEvents((prev) => prev.map((e) => (e.id === ev.id ? ev : e)));
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'ephemeral_statuses', filter: `connection_id=eq.${connection.id}` },
        () => {
          refreshEphemeralStatuses();
        },
      )
      .subscribe();

    realtimeEventsChannelRef.current = channel;

    return () => {
      realtimeEventsChannelRef.current = null;
      supabase.removeChannel(channel);
    };
  }, [connection, user?.id, partnerName, triggerNotificationOnce]);

  // ---- load ephemeral statuses
  const [ephemeralStatuses, setEphemeralStatuses] = useState<EphemeralStatus[]>([]);

  const refreshEphemeralStatuses = useCallback(async () => {
    if (!connection || connection.status !== 'accepted') {
      setEphemeralStatuses([]);
      return;
    }
    try {
      const { data } = await supabase
        .from('ephemeral_statuses')
        .select('*')
        .eq('connection_id', connection.id)
        .order('created_at', { ascending: false })
        .limit(20);
      if (data) {
        const now = Date.now();
        // Grace buffer of 5 minutes to prevent client clock skew from hiding valid statuses
        const active = (data as EphemeralStatus[]).filter(
          (s) => new Date(s.expires_at).getTime() > now - 5 * 60 * 1000
        );
        setEphemeralStatuses(active);
      }
    } catch (err) {
      console.warn('Error loading ephemeral statuses:', err);
    }
  }, [connection]);

  useEffect(() => {
    refreshEphemeralStatuses();
    const interval = setInterval(refreshEphemeralStatuses, 10000);
    const onFocus = () => refreshEphemeralStatuses();
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onFocus);
    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onFocus);
    };
  }, [refreshEphemeralStatuses]);

  const uploadEphemeralStatus = useCallback(
    async (type: 'PHOTO' | 'VIDEO' | 'VOICE', mediaUrl: string, caption?: string, duration?: number) => {
      if (!user || !connection) return { ok: false, error: 'Not connected' };

      try {
        // Ensure only 1 active status per user by deleting previous
        await supabase
          .from('ephemeral_statuses')
          .delete()
          .eq('user_id', user.id)
          .eq('connection_id', connection.id);

        const newStatus = {
          connection_id: connection.id,
          user_id: user.id,
          type,
          media_url: mediaUrl,
          caption: caption || null,
          duration: duration || 0,
          expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        };

        const { data, error } = await supabase.from('ephemeral_statuses').insert(newStatus).select().single();
        if (error) {
          console.error('Error inserting ephemeral status:', error);
          return { ok: false, error: error.message };
        }

        const created = data as EphemeralStatus;
        setEphemeralStatuses((prev) => [created, ...prev.filter((s) => s.user_id !== user.id)]);

        // Broadcast to partner over realtime channel for 0ms delivery
        if (realtimeEventsChannelRef.current) {
          realtimeEventsChannelRef.current.send({
            type: 'broadcast',
            event: 'new_ephemeral_status',
            payload: created,
          });
        }

        // Insert event row so Android Native HeartbeatService illuminates partner's locked screen!
        const myName = profile?.display_name || 'Your partner';
        const typeLabel =
          type === 'PHOTO'
            ? 'photo glance 📸'
            : type === 'VIDEO'
            ? '3s live video 🎥'
            : 'voice note 🎙️';

        await supabase
          .from('events')
          .insert({
            id: uuid(),
            connection_id: connection.id,
            sender_id: user.id,
            type: 'CUSTOM',
            emoji: type === 'PHOTO' ? '📸' : type === 'VIDEO' ? '🎥' : '🎙️',
            message: `${myName} posted a new 1-Hour Glance (${typeLabel})! Tap to view ❤️`,
            occurred_at: new Date().toISOString(),
            delivery_status: 'sent',
            created_offline: false,
            synced_at: new Date().toISOString(),
            created_at: new Date().toISOString(),
          });

        return { ok: true };
      } catch (err: any) {
        console.error('Failed to upload glance:', err);
        return { ok: false, error: err?.message || 'Failed to upload glance' };
      }
    },
    [user, connection, profile?.display_name],
  );

  const deleteEphemeralStatus = useCallback(async (id: string) => {
    setEphemeralStatuses((prev) => prev.filter((s) => s.id !== id));
    await supabase.from('ephemeral_statuses').delete().eq('id', id);
  }, []);

  const partnerStatus = useMemo(() => {
    if (!user) return null;
    return ephemeralStatuses.find((s) => s.user_id !== user.id) ?? null;
  }, [ephemeralStatuses, user]);

  const myStatus = useMemo(() => {
    if (!user) return null;
    return ephemeralStatuses.find((s) => s.user_id === user.id) ?? null;
  }, [ephemeralStatuses, user]);

  // ---- load places
  const refreshPlaces = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase.from('places').select('*').eq('owner_id', user.id).order('created_at');
    setPlaces((data as Place[]) ?? []);
  }, [user]);

  useEffect(() => {
    refreshPlaces();
  }, [refreshPlaces]);

  // ---- load quick messages
  const refreshQuickMessages = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('quick_messages')
      .select('*')
      .eq('owner_id', user.id)
      .order('pinned', { ascending: false })
      .order('sort_order');
    setQuickMessages((data as QuickMessage[]) ?? []);
  }, [user]);

  useEffect(() => {
    refreshQuickMessages();
  }, [refreshQuickMessages]);

  // ---- queue
  useEffect(() => {
    setQueueCount(loadQueue().length);
  }, []);

  const flushQueue = useCallback(async () => {
    if (!connection || connection.status !== 'accepted') return;
    const q = loadQueue();
    if (q.length === 0) return;
    const remaining: QueuedEvent[] = [];
    for (const item of q) {
      const ev: AppEvent = {
        id: item.id,
        connection_id: connection.id,
        sender_id: user!.id,
        type: item.type,
        message: item.message,
        emoji: item.emoji,
        occurred_at: item.occurred_at,
        latitude: item.latitude,
        longitude: item.longitude,
        accuracy: item.accuracy,
        place_id: item.place_id,
        delivery_status: 'sent',
        created_offline: true,
        synced_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
      };
      const { error } = await supabase.from('events').upsert(ev, { onConflict: 'id' });
      if (error) remaining.push(item);
      else removeFromQueue(item.id);
    }
    saveQueue(remaining);
    setQueueCount(remaining.length);
    await loadEvents();
  }, [connection, user, loadEvents]);

  useEffect(() => {
    if (online && connection?.status === 'accepted') flushQueue();
  }, [online, connection, flushQueue]);

  // ---- send event
  const send = useCallback<AppDataState['send']>(
    async (input) => {
      if (!user || !connection || connection.status !== 'accepted') {
        return { ok: false, offline: false, error: 'Not connected to Aanya yet.' };
      }
      setSending(true);
      const id = uuid();
      const occurredAt = new Date().toISOString();
      let lat: number | null = null;
      let lon: number | null = null;
      let acc: number | null = null;
      if (input.attachLocation) {
        const c = await getCurrentPosition();
        if (c) {
          lat = c.latitude;
          lon = c.longitude;
          acc = c.accuracy;
        }
      }
      const ev: AppEvent = {
        id,
        connection_id: connection.id,
        sender_id: user.id,
        type: input.type,
        message: input.message,
        emoji: input.emoji,
        occurred_at: occurredAt,
        latitude: lat,
        longitude: lon,
        accuracy: acc,
        place_id: input.placeId ?? null,
        delivery_status: 'sent',
        created_offline: false,
        synced_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
      };

      setEvents((prev) => [ev, ...prev]);

      // Direct sub-50ms peer-to-peer WebSocket broadcast push
      try {
        realtimeEventsChannelRef.current?.send({
          type: 'broadcast',
          event: 'instant_message',
          payload: ev,
        });
      } catch {
        // Continue to postgres insert
      }

      if (!online) {
        enqueue({
          id: ev.id,
          connection_id: connection.id,
          type: ev.type,
          message: ev.message,
          emoji: ev.emoji,
          occurred_at: ev.occurred_at,
          latitude: ev.latitude,
          longitude: ev.longitude,
          accuracy: ev.accuracy,
          place_id: ev.place_id,
          created_offline: true,
        });
        setQueueCount(loadQueue().length);
        setSending(false);
        return { ok: true, offline: true };
      }

      const { error } = await supabase.from('events').upsert(ev, { onConflict: 'id' });
      setSending(false);

      // Also trigger background push to partner in case their app or screen is closed
      if (partnerId) {
        dispatchPushToPartner(partnerId, `${ev.emoji} ${profile?.display_name ?? 'Your Partner'}`, ev.message);
      }

      if (error) {
        enqueue({
          id: ev.id,
          connection_id: connection.id,
          type: ev.type,
          message: ev.message,
          emoji: ev.emoji,
          occurred_at: ev.occurred_at,
          latitude: ev.latitude,
          longitude: ev.longitude,
          accuracy: ev.accuracy,
          place_id: ev.place_id,
          created_offline: true,
        });
        setQueueCount(loadQueue().length);
        return { ok: true, offline: true, error: error.message };
      }
      return { ok: true, offline: false };
    },
    [user, connection, online, partnerId, profile?.display_name],
  );

  // Initialize native push and lock-screen interactive notification actions
  useEffect(() => {
    initializeNotificationSystem(user?.id, async (actionId) => {
      if (actionId === 'reached_home') {
        await send({
          type: 'ARRIVED',
          emoji: '🏠',
          message: 'Reached Home safely ❤️',
          attachLocation: true,
        });
      } else if (actionId === 'on_my_way') {
        await send({
          type: 'CUSTOM',
          emoji: '🚗',
          message: 'On my way to you!',
          attachLocation: true,
        });
      } else if (actionId === 'send_love') {
        await send({
          type: 'THINKING',
          emoji: '💖',
          message: 'Thinking of you!',
        });
      }
    });
  }, [send, user?.id]);

  // ---- create connection
  const createConnection = useCallback<AppDataState['createConnection']>(async () => {
    if (!user) return { code: null, error: 'Sign in first.' };
    const code = generatePairingCode();
    localStorage.setItem('aanya_active_code', code);
    const { data, error } = await supabase
      .from('connections')
      .insert({ pairing_code: code, user_a: user.id, status: 'pending' })
      .select('*')
      .maybeSingle();
    if (error) return { code: null, error: error.message };
    setConnection(data as Connection);
    return { code };
  }, [user]);

  // ---- join connection
  const joinConnection = useCallback<AppDataState['joinConnection']>(async (rawCode) => {
    if (!user) return { ok: false, error: 'Sign in first.' };
    const code = rawCode.trim().toUpperCase();
    const { data: existing } = await supabase
      .from('connections')
      .select('*')
      .eq('pairing_code', code)
      .maybeSingle();
    const conn = existing as Connection | null;
    if (!conn) return { ok: false, error: 'No connection found for that code.' };

    // If this user is already one of the participants
    if (conn.user_a === user.id || conn.user_b === user.id) {
      setConnection(conn);
      localStorage.setItem('aanya_active_code', code);
      return { ok: true };
    }

    // Security Check: If the room is already taken by two other people, reject new profiles
    if (conn.user_b && conn.user_a !== user.id && conn.user_b !== user.id) {
      return { ok: false, error: 'This couple room is private and already occupied by two partners.' };
    }

    const { error } = await supabase
      .from('connections')
      .update({ user_b: user.id, status: 'accepted', accepted_at: new Date().toISOString() })
      .eq('id', conn.id);
    if (error) return { ok: false, error: error.message };
    setConnection({ ...conn, user_b: user.id, status: 'accepted' });
    localStorage.setItem('aanya_active_code', code);
    await loadConnection();
    return { ok: true };
  }, [user, loadConnection]);

  // ---- disconnect
  const disconnect = useCallback<AppDataState['disconnect']>(async () => {
    if (!connection) return { ok: false, error: 'No connection.' };
    const { error } = await supabase
      .from('connections')
      .update({ status: 'severed' })
      .eq('id', connection.id);
    if (error) return { ok: false, error: error.message };
    setConnection(null);
    setPartnerProfile(null);
    setEvents([]);
    localStorage.removeItem('aanya_cached_connection');
    localStorage.removeItem('aanya_cached_partner_profile');
    localStorage.removeItem('aanya_active_code');
    return { ok: true };
  }, [connection]);

  // ---- places CRUD
  const addPlace = useCallback<AppDataState['addPlace']>(async (p) => {
    if (!user) return { ok: false, error: 'Sign in first.' };
    const { error } = await supabase.from('places').insert({ ...p, owner_id: user.id });
    if (error) return { ok: false, error: error.message };
    await refreshPlaces();
    return { ok: true };
  }, [user, refreshPlaces]);

  const updatePlace = useCallback<AppDataState['updatePlace']>(async (id, patch) => {
    const { error } = await supabase.from('places').update(patch).eq('id', id);
    if (error) return { ok: false, error: error.message };
    await refreshPlaces();
    return { ok: true };
  }, [refreshPlaces]);

  const deletePlace = useCallback<AppDataState['deletePlace']>(async (id) => {
    const { error } = await supabase.from('places').delete().eq('id', id);
    if (error) return { ok: false, error: error.message };
    await refreshPlaces();
    return { ok: true };
  }, [refreshPlaces]);

  // ---- quick messages CRUD
  const addQuickMessage = useCallback<AppDataState['addQuickMessage']>(async (m) => {
    if (!user) return { ok: false, error: 'Sign in first.' };
    const { error } = await supabase.from('quick_messages').insert({ ...m, owner_id: user.id });
    if (error) return { ok: false, error: error.message };
    await refreshQuickMessages();
    return { ok: true };
  }, [user, refreshQuickMessages]);

  const updateQuickMessage = useCallback<AppDataState['updateQuickMessage']>(async (id, patch) => {
    const { error } = await supabase.from('quick_messages').update(patch).eq('id', id);
    if (error) return { ok: false, error: error.message };
    await refreshQuickMessages();
    return { ok: true };
  }, [refreshQuickMessages]);

  const deleteQuickMessage = useCallback<AppDataState['deleteQuickMessage']>(async (id) => {
    const { error } = await supabase.from('quick_messages').delete().eq('id', id);
    if (error) return { ok: false, error: error.message };
    await refreshQuickMessages();
    return { ok: true };
  }, [refreshQuickMessages]);

  const reorderQuickMessages = useCallback<AppDataState['reorderQuickMessages']>(async (orderedIds) => {
    if (!user) return;
    const updates = orderedIds.map((id, i) =>
      supabase.from('quick_messages').update({ sort_order: i }).eq('id', id).eq('owner_id', user.id),
    );
    await Promise.all(updates);
    await refreshQuickMessages();
  }, [user, refreshQuickMessages]);

  const ackEvent = useCallback<AppDataState['ackEvent']>(async (id) => {
    await supabase.from('events').update({ delivery_status: 'acked' }).eq('id', id);
  }, []);

  // Automatic background battery monitoring
  useEffect(() => {
    const unsub = initBatteryMonitoring(user?.id);
    return () => unsub();
  }, [user?.id]);

  const deleteEvent = useCallback<AppDataState['deleteEvent']>(async (id: string) => {
    setEvents((prev) => prev.filter((e) => e.id !== id));
    const { error } = await supabase.from('events').delete().eq('id', id);
    if (error) {
      return { ok: false, error: error.message };
    }
    return { ok: true };
  }, []);

  const setRetentionDays = useCallback((days: number) => {
    setRetentionDaysState(days);
    localStorage.setItem('aanya_retention_days', String(days));
  }, []);

  const toggleKeepForever = useCallback<AppDataState['toggleKeepForever']>(async (id: string) => {
    const current = events.find((e) => e.id === id)?.keep_forever ?? false;
    const next = !current;
    setEvents((prev) => prev.map((e) => (e.id === id ? { ...e, keep_forever: next } : e)));
    await supabase.from('events').update({ keep_forever: next }).eq('id', id);
  }, [events]);

  const cleanupOldEvents = useCallback<AppDataState['cleanupOldEvents']>(async (overrideDays) => {
    if (!connection) return { count: 0, error: 'No connection' };
    const days = overrideDays !== undefined ? overrideDays : retentionDays;
    if (days <= 0) return { count: 0 }; // 0 means keep forever

    try {
      // 1. Try Supabase RPC function first
      const { data: rpcCount, error: rpcErr } = await supabase.rpc('cleanup_old_events', {
        p_connection_id: connection.id,
        p_days_to_keep: days,
      });

      if (!rpcErr && typeof rpcCount === 'number') {
        await loadEvents();
        return { count: rpcCount };
      }

      // 2. Fallback to direct client delete if RPC not yet run
      const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from('events')
        .delete()
        .eq('connection_id', connection.id)
        .eq('keep_forever', false)
        .lt('occurred_at', cutoff)
        .select('id');

      if (error) return { count: 0, error: error.message };
      const count = data?.length ?? 0;
      if (count > 0) {
        await loadEvents();
      }
      return { count };
    } catch (e: any) {
      return { count: 0, error: e?.message ?? 'Cleanup error' };
    }
  }, [connection, retentionDays, loadEvents]);

  // Auto-cleanup on mount/connection
  const cleanedOnceRef = useRef(false);
  useEffect(() => {
    if (connection?.status === 'accepted' && retentionDays > 0 && !cleanedOnceRef.current) {
      cleanedOnceRef.current = true;
      cleanupOldEvents();
    }
  }, [connection, retentionDays, cleanupOldEvents]);

  // ---- location watch + arrival detection
  useEffect(() => {
    if (watchedRef.current) return;
    if (!('geolocation' in navigator)) return;
    watchedRef.current = true;
    watchPosition((c) => setCoords(c));
  }, []);

  useEffect(() => {
    if (!coords || !user || !connection || connection.status !== 'accepted') return;
    const activePlaces = places.filter(
      (p) => p.arrival_enabled && p.latitude != null && p.longitude != null,
    );
    if (activePlaces.length === 0) {
      setArrivalDiagnostics({ status: 'no-places', detail: 'No saved places with arrival detection enabled.' });
      return;
    }
    if (!('geolocation' in navigator)) {
      setArrivalDiagnostics({ status: 'no-permission', detail: 'Location not available on this device.' });
      return;
    }
    setArrivalDiagnostics({ status: 'working', detail: 'Monitoring saved places.' });
    let states = loadArrivalStates();
    for (const place of activePlaces) {
      const { result, states: next } = evaluateArrival(place, coords, states);
      states = next;
      if (result?.arrived) {
        const msg = place.arrival_message || `Reached ${place.name} safely ❤️`;
        send({
          type: 'ARRIVED',
          message: msg,
          emoji: place.emoji,
          placeId: place.id,
          attachLocation: profile?.location_mode === 'arrival' || profile?.location_mode === 'live',
        });
      } else if (result?.departed) {
        const msg = place.departure_message || `Left ${place.name} ❤️`;
        send({
          type: 'DEPARTED',
          message: msg,
          emoji: '🚗',
          placeId: place.id,
        });
      }
    }
    saveArrivalStates(states);
  }, [coords, places, user, connection, send, profile]);

  const lastEvent = events[0] ?? null;
  const myLastEvent = events.find((e) => e.sender_id === user?.id) ?? null;
  const partnerLastEvent = events.find((e) => e.sender_id !== user?.id) ?? null;

  const storageStats = useMemo(() => {
    const eventCount = events.length;
    const keptCount = events.filter((e) => e.keep_forever).length;
    // rough estimation: ~0.5KB per event payload
    const estimatedKB = Math.max(1, Math.round(eventCount * 0.5 + places.length * 0.4 + quickMessages.length * 0.2));
    // 500 MB free Supabase quota = 500,000 KB.
    // We compute percentage against 500MB quota (or against a soft 10,000 event target)
    const quotaPercent = Math.min(100, Number(((estimatedKB / 500000) * 100).toFixed(3)));
    return { eventCount, keptCount, estimatedKB, quotaPercent };
  }, [events, places, quickMessages]);

  const value = useMemo<AppDataState>(
    () => ({
      connection,
      partnerId,
      partnerName,
      partnerProfile,
      events,
      places,
      quickMessages,
      ephemeralStatuses,
      partnerStatus,
      myStatus,
      uploadEphemeralStatus,
      deleteEphemeralStatus,
      refreshEphemeralStatuses,
      online,
      queueCount,
      lastEvent,
      partnerLastEvent,
      myLastEvent,
      sending,
      send,
      createConnection,
      joinConnection,
      disconnect,
      refreshPlaces,
      refreshQuickMessages,
      addPlace,
      updatePlace,
      deletePlace,
      addQuickMessage,
      updateQuickMessage,
      deleteQuickMessage,
      reorderQuickMessages,
      ackEvent,
      deleteEvent,
      toggleKeepForever,
      cleanupOldEvents,
      retentionDays,
      setRetentionDays,
      storageStats,
      arrivalDiagnostics,
    }),
    [
      connection, partnerId, partnerName, partnerProfile, events, places, quickMessages,
      ephemeralStatuses, partnerStatus, myStatus, uploadEphemeralStatus, deleteEphemeralStatus,
      refreshEphemeralStatuses, online, queueCount, lastEvent, partnerLastEvent, myLastEvent,
      sending, send, createConnection, joinConnection, disconnect, refreshPlaces,
      refreshQuickMessages, addPlace, updatePlace, deletePlace, addQuickMessage,
      updateQuickMessage, deleteQuickMessage, reorderQuickMessages, ackEvent, deleteEvent,
      toggleKeepForever, cleanupOldEvents, retentionDays, setRetentionDays, storageStats,
      arrivalDiagnostics,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAppData(): AppDataState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAppData must be used within AppDataProvider');
  return ctx;
}
