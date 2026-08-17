import { useMemo, useState } from 'react';
import { useAppData } from '@/context/AppDataContext';
import { useAuth } from '@/context/AuthContext';
import { IconButton, EmptyState } from '@/components/ui';
import { EventRow } from '@/components/EventRow';
import { formatDayLabel } from '@/lib/format';
import type { AppEvent } from '@/lib/supabase';

type Filter = 'all' | 'messages' | 'locations' | 'saved' | 'sos';

export function History({ onBack }: { onBack: () => void }) {
  const { events, toggleKeepForever } = useAppData();
  const { profile } = useAuth();
  const [filter, setFilter] = useState<Filter>('all');
  const [showLocation, setShowLocation] = useState<AppEvent | null>(null);

  const filtered = useMemo(() => {
    return events.filter((e) => {
      if (filter === 'messages') return !['ARRIVED', 'DEPARTED', 'SOS'].includes(e.type);
      if (filter === 'locations') return ['ARRIVED', 'DEPARTED'].includes(e.type);
      if (filter === 'saved') return Boolean(e.keep_forever);
      if (filter === 'sos') return e.type === 'SOS';
      return true;
    });
  }, [events, filter]);

  const grouped = useMemo(() => {
    const map = new Map<string, AppEvent[]>();
    for (const e of filtered) {
      const day = formatDayLabel(e.occurred_at);
      const arr = map.get(day) ?? [];
      arr.push(e);
      map.set(day, arr);
    }
    return Array.from(map.entries());
  }, [filtered]);

  return (
    <div className="app-shell px-5 py-6">
      <header className="flex items-center gap-2">
        <IconButton aria-label="Back" onClick={onBack}>←</IconButton>
        <h1 className="text-xl">History</h1>
      </header>

      <div className="mt-4 flex gap-1.5 overflow-x-auto pb-1">
        {([
          ['all', 'All'],
          ['messages', 'Messages'],
          ['locations', 'Locations'],
          ['saved', '⭐ Saved'],
          ['sos', 'SOS'],
        ] as [Filter, string][]).map(([f, label]) => (
          <button
            key={f}
            className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium ${filter === f ? 'bg-accent text-accent-fg' : 'bg-bg-elev text-fg-soft'}`}
            onClick={() => setFilter(f)}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="mt-4 flex flex-col gap-4">
        {grouped.length === 0 ? (
          <EmptyState
            icon={filter === 'saved' ? '⭐' : '📜'}
            title={filter === 'saved' ? 'No saved memories' : 'Nothing here yet'}
            subtitle={
              filter === 'saved'
                ? 'Tap the star on any message to save it permanently.'
                : 'Your messages and check-ins will appear here.'
            }
          />
        ) : (
          grouped.map(([day, evs]) => (
            <div key={day}>
              <p className="px-1 pb-2 text-xs font-semibold uppercase tracking-wider text-muted">{day}</p>
              <div className="card divide-y divide-border overflow-hidden">
                {evs.map((e) => (
                  <EventRow
                    key={e.id}
                    event={e}
                    myId={profile?.id ?? ''}
                    onShowLocation={(ev) => setShowLocation(ev)}
                    onToggleKeepForever={(ev) => toggleKeepForever(ev.id)}
                  />
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      {showLocation && (
        <LocationModal event={showLocation} onClose={() => setShowLocation(null)} />
      )}
    </div>
  );
}

function LocationModal({ event, onClose }: { event: AppEvent; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="card relative z-10 m-0 w-full max-w-md rounded-b-none p-5 sm:m-4 sm:rounded-3xl">
        <h3 className="mb-3 text-lg">Shared location</h3>
        {event.latitude != null && event.longitude != null ? (
          <div>
            <div className="overflow-hidden rounded-2xl border border-border">
              <iframe
                title="map"
                className="h-48 w-full"
                loading="lazy"
                src={`https://www.openstreetmap.org/export/embed.html?marker=${event.latitude},${event.longitude}&bbox=${event.longitude - 0.01},${event.latitude - 0.01},${event.longitude + 0.01},${event.latitude + 0.01}`}
              />
            </div>
            <p className="mt-3 text-sm text-fg-soft">{event.emoji} {event.message}</p>
            <a href={`https://www.google.com/maps/search/?api=1&query=${event.latitude},${event.longitude}`} target="_blank" rel="noreferrer" className="btn btn-outline mt-3 w-full">Open in Maps</a>
          </div>
        ) : (
          <p className="text-sm text-muted">No location attached.</p>
        )}
      </div>
    </div>
  );
}
