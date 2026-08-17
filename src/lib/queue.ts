import type { AppEvent } from './supabase';

const KEY = 'aanya_queue_v1';

export interface QueuedEvent {
  id: string;
  connection_id: string;
  type: AppEvent['type'];
  message: string;
  emoji: string;
  occurred_at: string;
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
  place_id: string | null;
  created_offline: boolean;
}

export function loadQueue(): QueuedEvent[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    return JSON.parse(raw) as QueuedEvent[];
  } catch {
    return [];
  }
}

export function saveQueue(q: QueuedEvent[]): void {
  localStorage.setItem(KEY, JSON.stringify(q));
}

export function enqueue(ev: QueuedEvent): QueuedEvent[] {
  const q = loadQueue().filter((e) => e.id !== ev.id);
  q.push(ev);
  saveQueue(q);
  return q;
}

export function removeFromQueue(id: string): QueuedEvent[] {
  const q = loadQueue().filter((e) => e.id !== id);
  saveQueue(q);
  return q;
}

export function clearQueue(): void {
  saveQueue([]);
}
