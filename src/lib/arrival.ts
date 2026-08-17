import type { Place } from './supabase';
import type { Coords } from './location';
import { distanceMeters } from './format';

export interface ArrivalState {
  placeId: string;
  enteredAt: number | null;
  notified: boolean;
}

const KEY = 'aanya_arrival_state_v1';

export function loadArrivalStates(): Record<string, ArrivalState> {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, ArrivalState>;
  } catch {
    return {};
  }
}

export function saveArrivalStates(s: Record<string, ArrivalState>): void {
  localStorage.setItem(KEY, JSON.stringify(s));
}

export function resetArrivalState(placeId: string): void {
  const s = loadArrivalStates();
  delete s[placeId];
  saveArrivalStates(s);
}

export interface ArrivalResult {
  place: Place;
  arrived: boolean;
  departed: boolean;
}

export function evaluateArrival(
  place: Place,
  coords: Coords,
  states: Record<string, ArrivalState>,
  now: number = Date.now(),
): { result: ArrivalResult | null; states: Record<string, ArrivalState> } {
  if (place.latitude == null || place.longitude == null) {
    return { result: null, states };
  }
  const dist = distanceMeters(coords.latitude, coords.longitude, place.latitude, place.longitude);
  const inside = dist <= place.radius;
  let state = states[place.id] ?? { placeId: place.id, enteredAt: null, notified: false };

  let result: ArrivalResult | null = null;

  if (inside) {
    if (state.enteredAt == null) {
      state = { ...state, enteredAt: now };
    }
    const dwellMs = place.dwell_minutes * 60 * 1000;
    if (!state.notified && now - (state.enteredAt ?? now) >= dwellMs) {
      state = { ...state, notified: true };
      if (place.arrival_enabled) {
        result = { place, arrived: true, departed: false };
      }
    }
  } else {
    if (state.notified && place.departure_enabled) {
      result = { place, arrived: false, departed: true };
    }
    state = { placeId: place.id, enteredAt: null, notified: false };
  }

  const next = { ...states, [place.id]: state };
  return { result, states: next };
}
