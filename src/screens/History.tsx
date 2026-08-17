import { useMemo, useState } from 'react';
import { useAppData } from '@/context/AppDataContext';
import { useAuth } from '@/context/AuthContext';
import { EmptyState, Modal } from '@/components/ui';
import { EventRow } from '@/components/EventRow';
import { formatDayLabel, formatTime } from '@/lib/format';
import { mapsLink } from '@/lib/location';
import type { AppEvent } from '@/lib/supabase';
import { ArrowLeft, Clock, Star, MapPin } from 'lucide-react';

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
    <div className="app-shell px-5 py-6 flex flex-col gap-4">
      {/* Header */}
      <header className="flex items-center gap-2">
        <button
          onClick={onBack}
          className="flex h-10 w-10 items-center justify-center rounded-2xl bg-card border border-border/80 text-fg shadow-sm active:scale-95 transition"
          aria-label="Back"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-2xl text-fg">Shared Moments</h1>
          <p className="text-xs text-muted">Your memories and check-in timeline</p>
        </div>
      </header>

      {/* Filter Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
        {([
          ['all', '✨ All'],
          ['messages', '💬 Messages'],
          ['locations', '📍 Locations'],
          ['saved', '⭐ Saved Forever'],
          ['sos', '🚨 SOS'],
        ] as [Filter, string][]).map(([f, label]) => (
          <button
            key={f}
            className={`whitespace-nowrap rounded-2xl px-4 py-2 text-xs font-semibold transition-all ${
              filter === f
                ? 'bg-accent text-white shadow-md shadow-accent/20 scale-105'
                : 'bg-card border border-border/80 text-fg-soft hover:bg-accent-soft/30'
            }`}
            onClick={() => setFilter(f)}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Moments Grouped by Day */}
      <div className="flex flex-col gap-4">
        {grouped.length === 0 ? (
          <EmptyState
            icon={filter === 'saved' ? '⭐' : '💌'}
            title={filter === 'saved' ? 'No saved memories yet' : 'No moments found'}
            subtitle={
              filter === 'saved'
                ? 'Tap the star (⭐) on any message in your feed to save it permanently!'
                : 'Your sent messages, arrivals and pokes will be recorded here.'
            }
          />
        ) : (
          grouped.map(([day, evs]) => (
            <div key={day} className="fade-up">
              <p className="px-2 pb-2 text-xs font-bold uppercase tracking-wider text-muted">
                {day}
              </p>
              <div className="card divide-y divide-border/60 overflow-hidden">
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
    <Modal open onClose={onClose} title="Shared Location Moment">
      {event.latitude != null && event.longitude != null ? (
        <div className="flex flex-col gap-3">
          <div className="overflow-hidden rounded-2xl border border-border/80 shadow-sm">
            <iframe
              title="map"
              className="h-48 w-full"
              loading="lazy"
              src={`https://www.openstreetmap.org/export/embed.html?marker=${event.latitude},${event.longitude}&bbox=${event.longitude - 0.01},${event.latitude - 0.01},${event.longitude + 0.01},${event.latitude + 0.01}`}
            />
          </div>
          <div className="rounded-2xl bg-bg-elev p-3 border border-border/60">
            <p className="text-sm font-semibold text-fg">
              {event.emoji} {event.message}
            </p>
            <p className="mt-0.5 text-xs text-muted">
              {formatTime(event.occurred_at)}
            </p>
          </div>
          <a
            href={mapsLink(event.latitude, event.longitude)}
            target="_blank"
            rel="noreferrer"
            className="btn btn-outline w-full"
          >
            <MapPin className="h-4 w-4 text-accent" />
            <span>Open in Maps</span>
          </a>
        </div>
      ) : (
        <p className="text-xs text-muted">No location attached to this moment.</p>
      )}
    </Modal>
  );
}
