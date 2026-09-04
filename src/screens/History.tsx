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
  const { events, partnerName, toggleKeepForever, deleteEvent } = useAppData();
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
    <div className="app-shell px-5 pt-8 pb-44 flex flex-col gap-4">
      {/* Top Bar */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex h-10 w-10 items-center justify-center rounded-2xl bg-card border border-border/80 text-fg hover:bg-accent-soft/30 transition shadow-sm"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-lg font-serif font-bold text-fg">Timeline History</h1>
        <div className="h-10 w-10" />
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
        {(
          [
            { key: 'all', label: 'All', icon: Clock },
            { key: 'saved', label: 'Saved ⭐', icon: Star },
            { key: 'messages', label: 'Messages', icon: Clock },
            { key: 'locations', label: 'Places', icon: MapPin },
            { key: 'sos', label: 'SOS 🚨', icon: null },
          ] as const
        ).map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key as Filter)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
              filter === tab.key
                ? 'bg-accent text-white shadow-md shadow-accent/25'
                : 'bg-card border border-border/60 text-muted hover:text-fg'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Grouped Day List */}
      <div className="flex flex-col gap-4">
        {grouped.length === 0 ? (
          <div className="card p-8 text-center text-muted">
            <span className="text-3xl mb-2 block">📭</span>
            <p className="text-sm font-semibold">No moments found</p>
            <p className="text-xs text-muted mt-1">Try switching filter tabs above.</p>
          </div>
        ) : (
          grouped.map(([day, evs]) => (
            <div key={day}>
              <p className="px-2 pb-2 text-xs font-bold uppercase tracking-wider text-muted">
                {day}
              </p>
              <div className="card divide-y divide-border/60 overflow-hidden">
                {evs.map((e) => (
                  <EventRow
                    key={e.id}
                    event={e}
                    myId={profile?.id ?? ''}
                    partnerName={partnerName}
                    onShowLocation={(ev) => setShowLocation(ev)}
                    onToggleKeepForever={(ev) => toggleKeepForever(ev.id)}
                    onDelete={(ev) => deleteEvent(ev.id)}
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

      {/* Bottom spacer for floating navigation clearance on mobile */}
      <div className="h-28 shrink-0 w-full md:hidden" aria-hidden="true" />
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
