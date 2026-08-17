import { useState } from 'react';
import { useAppData } from '@/context/AppDataContext';
import { Button, EmptyState, Modal, Toggle } from '@/components/ui';
import { getCurrentPosition } from '@/lib/location';
import type { Place } from '@/lib/supabase';
import { MapPin, Plus, Navigation, Crosshair, Check, Trash2, ArrowLeft } from 'lucide-react';

const EMOJIS = ['📍', '🏠', '🏢', '🎓', '🏋️', '🛒', '✈️', '☕', '🌳', '❤️', '🏖️', '🍿'];

export function Places({ onBack }: { onBack: () => void }) {
  const { places, addPlace, updatePlace, deletePlace, arrivalDiagnostics } = useAppData();
  const [editing, setEditing] = useState<Place | null>(null);
  const [creating, setCreating] = useState(false);

  return (
    <div className="app-shell px-5 pt-8 pb-44 flex flex-col gap-4">
      {/* Header */}
      <header className="flex items-center justify-between pt-2">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="flex h-10 w-10 items-center justify-center rounded-2xl bg-card border border-border/80 text-fg shadow-sm active:scale-95 transition"
            aria-label="Back"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-2xl text-fg font-serif">Saved Places</h1>
            <p className="text-xs text-muted">Geofenced arrival &amp; departure alerts</p>
          </div>
        </div>
        <button
          onClick={() => setCreating(true)}
          className="flex h-10 w-10 items-center justify-center rounded-2xl bg-accent text-white shadow-md shadow-accent/25 active:scale-95 transition"
          aria-label="Add place"
        >
          <Plus className="h-5 w-5" />
        </button>
      </header>

      {/* Arrival Detection Status Banner */}
      <div className="card p-4 bg-gradient-to-r from-card to-accent-soft/20">
        <div className="flex items-center gap-2.5">
          <div
            className={`h-3 w-3 rounded-full ${
              arrivalDiagnostics.status === 'working'
                ? 'bg-emerald-500 animate-pulse'
                : arrivalDiagnostics.status === 'no-permission'
                  ? 'bg-rose-500'
                  : 'bg-amber-500'
            }`}
          />
          <p className="text-xs font-bold uppercase tracking-wider text-fg-soft">
            Auto Arrival Detection
          </p>
        </div>
        <p className="mt-1 text-xs text-muted font-medium">{arrivalDiagnostics.detail}</p>
      </div>

      {/* Places List */}
      <div className="flex flex-col gap-3 pb-6">
        {places.length === 0 ? (
          <EmptyState
            icon="📍"
            title="No saved places yet"
            subtitle="Add Home, Work, College or Gym to automatically notify your partner when you arrive safely."
            action={
              <Button onClick={() => setCreating(true)} className="mt-2">
                <Plus className="h-4 w-4" />
                <span>Add Your First Place</span>
              </Button>
            }
          />
        ) : (
          places.map((p) => <PlaceCard key={p.id} place={p} onEdit={() => setEditing(p)} />)
        )}
      </div>

      {(creating || editing) && (
        <PlaceEditor
          place={editing}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
          onSave={async (data) => {
            if (editing) {
              await updatePlace(editing.id, data);
            } else {
              await addPlace(data as Omit<Place, 'id' | 'owner_id' | 'created_at'>);
            }
            setCreating(false);
            setEditing(null);
          }}
          onDelete={
            editing
              ? async () => {
                  await deletePlace(editing.id);
                  setEditing(null);
                }
              : undefined
          }
        />
      )}

      {/* Bottom spacer for floating navigation clearance on mobile */}
      <div className="h-28 shrink-0 w-full md:hidden" aria-hidden="true" />
    </div>
  );
}

function PlaceCard({ place, onEdit }: { place: Place; onEdit: () => void }) {
  const hasCoords = place.latitude != null && place.longitude != null;
  return (
    <button
      className="card p-4 text-left fade-up hover:border-accent/40 active:scale-[0.98] transition flex items-center gap-3"
      onClick={onEdit}
    >
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-accent-soft text-2xl shadow-sm">
        {place.emoji}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-fg truncate">{place.name}</p>
        <p className="text-xs text-muted mt-0.5 truncate">
          {hasCoords ? `${place.latitude?.toFixed(4)}, ${place.longitude?.toFixed(4)}` : 'No GPS location set'}
          {' · '}
          {place.radius}m radius
        </p>
      </div>
      <div className="flex flex-col items-end gap-1 shrink-0">
        {place.arrival_enabled && <span className="chip text-[10px] py-0.5 px-2">Arrival</span>}
        {place.departure_enabled && (
          <span className="chip text-[10px] py-0.5 px-2 bg-bg-elev text-fg-soft border border-border">
            Departure
          </span>
        )}
      </div>
    </button>
  );
}

function PlaceEditor({
  place,
  onClose,
  onSave,
  onDelete,
}: {
  place: Place | null;
  onClose: () => void;
  onSave: (data: Partial<Place>) => void;
  onDelete?: () => void;
}) {
  const [name, setName] = useState(place?.name ?? '');
  const [emoji, setEmoji] = useState(place?.emoji ?? '📍');
  const [radius, setRadius] = useState(place?.radius ?? 150);
  const [dwell, setDwell] = useState(place?.dwell_minutes ?? 5);
  const [arrivalEnabled, setArrivalEnabled] = useState(place?.arrival_enabled ?? true);
  const [departureEnabled, setDepartureEnabled] = useState(place?.departure_enabled ?? false);
  const [arrivalMessage, setArrivalMessage] = useState(place?.arrival_message ?? '');
  const [departureMessage, setDepartureMessage] = useState(place?.departure_message ?? '');
  const [lat, setLat] = useState(place?.latitude ?? null);
  const [lon, setLon] = useState(place?.longitude ?? null);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function useCurrentLocation() {
    setLocating(true);
    setError(null);
    const c = await getCurrentPosition();
    setLocating(false);
    if (c) {
      setLat(c.latitude);
      setLon(c.longitude);
    } else {
      setError("Couldn't retrieve current GPS coordinates.");
    }
  }

  function save() {
    if (!name.trim()) {
      setError('Please give this place a name.');
      return;
    }
    onSave({
      name: name.trim(),
      emoji,
      radius,
      dwell_minutes: dwell,
      arrival_enabled: arrivalEnabled,
      departure_enabled: departureEnabled,
      arrival_message: arrivalMessage || null,
      departure_message: departureMessage || null,
      latitude: lat,
      longitude: lon,
    });
  }

  return (
    <Modal open onClose={onClose} title={place ? 'Edit Place' : 'Add New Place'}>
      <div className="flex flex-col gap-4">
        {/* Name & Emoji input */}
        <div className="flex gap-2">
          <input
            className="input w-16 text-center text-2xl p-2"
            value={emoji}
            onChange={(e) => setEmoji(e.target.value.slice(0, 2))}
          />
          <input
            className="input flex-1 font-medium"
            placeholder="Place name (e.g. Home, Office, Gym)"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        {/* Emoji Quick Picker */}
        <div className="flex flex-wrap gap-1.5 justify-center py-1">
          {EMOJIS.map((e) => (
            <button
              key={e}
              type="button"
              className={`h-9 w-9 rounded-2xl text-lg flex items-center justify-center transition-all ${
                emoji === e ? 'bg-accent text-white scale-110 shadow-sm' : 'bg-bg-elev hover:bg-accent-soft/40'
              }`}
              onClick={() => setEmoji(e)}
            >
              {e}
            </button>
          ))}
        </div>

        {/* Location Coordinates Card */}
        <div className="card p-3.5 bg-bg-elev">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-fg-soft">GPS Coordinates</p>
              <p className="text-xs text-muted mt-0.5">
                {lat != null && lon != null
                  ? `${lat.toFixed(5)}, ${lon.toFixed(5)}`
                  : 'Tap below to capture current location'}
              </p>
            </div>
            <Button size="sm" variant="outline" onClick={useCurrentLocation} loading={locating}>
              <Crosshair className="h-3.5 w-3.5" />
              <span>Use Current</span>
            </Button>
          </div>
        </div>

        {/* Radius Slider */}
        <div className="card p-3.5">
          <div className="flex justify-between text-xs font-semibold mb-1">
            <span className="text-fg-soft">Detection Radius</span>
            <span className="text-accent">{radius} meters</span>
          </div>
          <input
            type="range"
            min={50}
            max={500}
            step={10}
            value={radius}
            onChange={(e) => setRadius(Number(e.target.value))}
            className="w-full accent-accent cursor-pointer"
          />
        </div>

        {/* Dwell time buttons */}
        <div>
          <label className="text-xs font-semibold text-fg-soft mb-1.5 block">
            Dwell time before alert: {dwell} min
          </label>
          <div className="flex gap-1.5">
            {[1, 3, 5, 10, 15].map((m) => (
              <button
                key={m}
                type="button"
                className={`flex-1 rounded-2xl py-2 text-xs font-semibold transition-all ${
                  dwell === m ? 'bg-accent text-white shadow-sm' : 'bg-bg-elev text-fg-soft hover:bg-accent-soft/30'
                }`}
                onClick={() => setDwell(m)}
              >
                {m}m
              </button>
            ))}
          </div>
        </div>

        {/* Automatic Arrival */}
        <div className="card p-3.5 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-fg">Automatic Arrival</p>
              <p className="text-[11px] text-muted">Notify partner when you arrive</p>
            </div>
            <Toggle checked={arrivalEnabled} onChange={setArrivalEnabled} />
          </div>
          {arrivalEnabled && (
            <input
              className="input text-xs"
              placeholder="Custom arrival message (e.g. Reached Home safely ❤️)"
              value={arrivalMessage}
              onChange={(e) => setArrivalMessage(e.target.value)}
            />
          )}
        </div>

        {/* Automatic Departure */}
        <div className="card p-3.5 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-fg">Automatic Departure</p>
              <p className="text-[11px] text-muted">Notify partner when you leave</p>
            </div>
            <Toggle checked={departureEnabled} onChange={setDepartureEnabled} />
          </div>
          {departureEnabled && (
            <input
              className="input text-xs"
              placeholder="Custom departure message (e.g. Leaving Work ❤️)"
              value={departureMessage}
              onChange={(e) => setDepartureMessage(e.target.value)}
            />
          )}
        </div>

        {error && <p className="text-xs text-danger font-semibold">{error}</p>}

        <div className="flex flex-col gap-2 mt-2">
          <Button onClick={save} size="lg" className="w-full">
            {place ? 'Save Changes' : 'Add Place ❤️'}
          </Button>
          {onDelete && (
            <Button variant="ghost" className="text-danger w-full" onClick={onDelete}>
              <Trash2 className="h-4 w-4" />
              <span>Delete Place</span>
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}
