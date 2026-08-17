import { useState } from 'react';
import { useAppData } from '@/context/AppDataContext';
import { Button, EmptyState, IconButton, Modal, Toggle } from '@/components/ui';
import { getCurrentPosition } from '@/lib/location';
import type { Place } from '@/lib/supabase';

const EMOJIS = ['📍', '🏠', '🏢', '🎓', '🏋️', '🛒', '✈️', '☕', '🌳', '❤️'];

export function Places({ onBack }: { onBack: () => void }) {
  const { places, addPlace, updatePlace, deletePlace, arrivalDiagnostics } = useAppData();
  const [editing, setEditing] = useState<Place | null>(null);
  const [creating, setCreating] = useState(false);

  return (
    <div className="app-shell px-5 py-6">
      <header className="flex items-center gap-2">
        <IconButton aria-label="Back" onClick={onBack}>←</IconButton>
        <h1 className="text-xl">Places</h1>
      </header>

      <div className="mt-4 card p-4">
        <div className="flex items-center gap-2">
          <span className={`h-2.5 w-2.5 rounded-full ${arrivalDiagnostics.status === 'working' ? 'bg-success' : arrivalDiagnostics.status === 'no-permission' ? 'bg-danger' : 'bg-warning'}`} />
          <p className="text-sm font-medium">Automatic arrival detection</p>
        </div>
        <p className="mt-1 text-xs text-muted">{arrivalDiagnostics.detail}</p>
      </div>

      <div className="mt-4 flex items-center justify-between px-1 pb-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted">Saved places</p>
        <Button size="sm" onClick={() => setCreating(true)}>+ Add</Button>
      </div>

      {places.length === 0 ? (
        <EmptyState
          icon="📍"
          title="No places yet"
          subtitle="Save Home, Office, College and more to get automatic 'reached safely' messages."
          action={<Button onClick={() => setCreating(true)}>Add your first place</Button>}
        />
      ) : (
        <div className="flex flex-col gap-3">
          {places.map((p) => (
            <PlaceCard key={p.id} place={p} onEdit={() => setEditing(p)} />
          ))}
        </div>
      )}

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
    </div>
  );
}

function PlaceCard({ place, onEdit }: { place: Place; onEdit: () => void }) {
  return (
    <button className="card p-4 text-left fade-up" onClick={onEdit}>
      <div className="flex items-center gap-3">
        <span className="text-2xl">{place.emoji}</span>
        <div className="flex-1">
          <p className="text-sm font-medium">{place.name}</p>
          <p className="text-xs text-muted">
            {place.latitude != null && place.longitude != null ? `${place.latitude.toFixed(4)}, ${place.longitude.toFixed(4)}` : 'No location set'}
            {' · '}radius {place.radius}m
          </p>
        </div>
        <div className="flex flex-col items-end gap-1 text-xs">
          {place.arrival_enabled && <span className="chip">Arrival</span>}
          {place.departure_enabled && <span className="chip">Departure</span>}
        </div>
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
      setError("Couldn't get your current location.");
    }
  }

  function save() {
    if (!name.trim()) {
      setError('Give this place a name.');
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
    <Modal open onClose={onClose} title={place ? 'Edit place' : 'Add place'}>
      <div className="flex flex-col gap-3">
        <div className="flex gap-2">
          <input
            className="input w-16 text-center text-2xl"
            value={emoji}
            onChange={(e) => setEmoji(e.target.value.slice(0, 2))}
          />
          <input
            className="input flex-1"
            placeholder="Place name (Home, Office…)"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        <div className="flex flex-wrap gap-1.5">
          {EMOJIS.map((e) => (
            <button
              key={e}
              className={`h-9 w-9 rounded-full text-lg ${emoji === e ? 'bg-accent-soft' : 'bg-bg-elev'}`}
              onClick={() => setEmoji(e)}
            >
              {e}
            </button>
          ))}
        </div>

        <div className="card p-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">Location</p>
            <Button size="sm" variant="outline" onClick={useCurrentLocation} loading={locating}>
              Use current
            </Button>
          </div>
          {lat != null && lon != null ? (
            <p className="mt-2 text-xs text-muted">{lat.toFixed(5)}, {lon.toFixed(5)}</p>
          ) : (
            <p className="mt-2 text-xs text-muted">No location set. Tap "Use current".</p>
          )}
        </div>

        <div>
          <label className="text-xs font-medium text-fg-soft">Geofence radius: {radius}m</label>
          <input
            type="range"
            min={50}
            max={500}
            step={10}
            value={radius}
            onChange={(e) => setRadius(Number(e.target.value))}
            className="w-full accent-accent"
          />
        </div>

        <div>
          <label className="text-xs font-medium text-fg-soft">Dwell time before arrival: {dwell} min</label>
          <div className="mt-1 flex gap-1.5">
            {[1, 3, 5, 10, 15].map((m) => (
              <button
                key={m}
                className={`flex-1 rounded-full py-1.5 text-xs ${dwell === m ? 'bg-accent text-accent-fg' : 'bg-bg-elev text-fg-soft'}`}
                onClick={() => setDwell(m)}
              >
                {m}m
              </button>
            ))}
          </div>
        </div>

        <div className="card p-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Automatic arrival</p>
              <p className="text-xs text-muted">Tell Aanya when you arrive</p>
            </div>
            <Toggle checked={arrivalEnabled} onChange={setArrivalEnabled} />
          </div>
          {arrivalEnabled && (
            <input
              className="input mt-2"
              placeholder="Arrival message (default: Reached … safely ❤️)"
              value={arrivalMessage}
              onChange={(e) => setArrivalMessage(e.target.value)}
            />
          )}
        </div>

        <div className="card p-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Automatic departure</p>
              <p className="text-xs text-muted">Tell Aanya when you leave</p>
            </div>
            <Toggle checked={departureEnabled} onChange={setDepartureEnabled} />
          </div>
          {departureEnabled && (
            <input
              className="input mt-2"
              placeholder="Departure message (default: Left … ❤️)"
              value={departureMessage}
              onChange={(e) => setDepartureMessage(e.target.value)}
            />
          )}
        </div>

        {error && <p className="text-sm text-danger">{error}</p>}

        <Button onClick={save} size="lg">{place ? 'Save changes' : 'Add place'}</Button>
        {onDelete && (
          <Button variant="ghost" className="text-danger" onClick={onDelete}>
            Delete place
          </Button>
        )}
      </div>
    </Modal>
  );
}
