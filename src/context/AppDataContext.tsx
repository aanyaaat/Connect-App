import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { supabase, type AppEvent, type Connection, type Place, type QuickMessage, type EventType } from '@/lib/supabase';
import { useAuth } from './AuthContext';
import { enqueue, loadQueue, removeFromQueue, saveQueue, type QueuedEvent } from '@/lib/queue';
import { generatePairingCode } from '@/lib/format';
import { showLocalNotification } from '@/lib/notifications';
import { getCurrentPosition, watchPosition, type Coords } from '@/lib/location';
import { evaluateArrival, loadArrivalStates, saveArrivalStates } from '@/lib/arrival';

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
  events: AppEvent[];
  places: Place[];
  quickMessages: QuickMessage[];
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
  const [connection, setConnection] = useState<Connection | null>(null);
  const [events, setEvents] = useState<AppEvent[]>([]);
  const [places, setPlaces] = useState<Place[]>([]);
  const [quickMessages, setQuickMessages] = useState<QuickMessage[]>([]);
  const [online, setOnline] = useState(navigator.onLine);
  const [queueCount, setQueueCount] = useState(0);
  const [sending, setSending] = useState(false);
  const [partnerProfile, setPartnerProfile] = useState<{ id: string; display_name: string } | null>(null);
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

  // ---- load connection
  const loadConnection = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('connections')
      .select('*')
      .or(`user_a.eq.${user.id},user_b.eq.${user.id}`)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data) {
      setConnection(data as Connection);
      if (data.pairing_code) {
        localStorage.setItem('aanya_active_code', data.pairing_code);
      }
    } else {
      setConnection(null);
    }
  }, [user]);

  useEffect(() => {
    if (user) loadConnection();
    else {
      setConnection(null);
      setEvents([]);
      setPlaces([]);
      setQuickMessages([]);
    }
  }, [user, loadConnection]);

  // Realtime connection listener so creator immediately gets accepted when partner joins!
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
            if (c.pairing_code) localStorage.setItem('aanya_active_code', c.pairing_code);
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  // Polling fallback when connection is pending or null (every 3 seconds)
  useEffect(() => {
    if (!user) return;
    if (connection?.status === 'accepted') return;

    const interval = setInterval(() => {
      loadConnection();
    }, 3000);

    return () => clearInterval(interval);
  }, [user, connection?.status, loadConnection]);

  // ---- load partner profile
  useEffect(() => {
    if (!partnerId) {
      setPartnerProfile(null);
      return;
    }
    supabase
      .from('profiles')
      .select('id, display_name')
      .eq('id', partnerId)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setPartnerProfile(data as { id: string; display_name: string });
      });
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

  // ---- realtime
  useEffect(() => {
    if (!connection || connection.status !== 'accepted') return;
    const channel = supabase
      .channel(`events:${connection.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'events', filter: `connection_id=eq.${connection.id}` },
        (payload) => {
          const ev = payload.new as AppEvent;
          setEvents((prev) => (prev.some((e) => e.id === ev.id) ? prev : [ev, ...prev]));
          if (ev.sender_id !== user?.id) {
            showLocalNotification({
              title: `${ev.emoji} ${partnerName}`,
              body: ev.message,
              tag: ev.id,
            });
          }
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
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [connection, user?.id, partnerName]);

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
    [user, connection, online],
  );

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

    // If this device is already one of the participants (e.g. testing between mobile & browser)
    if (conn.user_a === user.id || conn.user_b === user.id) {
      setConnection(conn);
      localStorage.setItem('aanya_active_code', code);
      return { ok: true };
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
    setEvents([]);
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
      events,
      places,
      quickMessages,
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
      toggleKeepForever,
      cleanupOldEvents,
      retentionDays,
      setRetentionDays,
      storageStats,
      arrivalDiagnostics,
    }),
    [
      connection, partnerId, partnerName, events, places, quickMessages, online, queueCount,
      lastEvent, partnerLastEvent, myLastEvent, sending, send, createConnection, joinConnection,
      disconnect, refreshPlaces, refreshQuickMessages, addPlace, updatePlace, deletePlace,
      addQuickMessage, updateQuickMessage, deleteQuickMessage, reorderQuickMessages, ackEvent,
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
