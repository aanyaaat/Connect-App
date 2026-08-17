import { useEffect, useMemo, useState } from 'react';
import { useAppData } from '@/context/AppDataContext';
import { useAuth } from '@/context/AuthContext';
import { DEFAULT_QUICK_ACTIONS, type QuickAction } from '@/lib/quickActions';
import { formatRelative, formatTime, greeting, rotatingMicrocopy } from '@/lib/format';
import { mapsLink } from '@/lib/location';
import { Button, EmptyState, IconButton, Modal, Toast, Toggle } from '@/components/ui';
import { SosButton } from '@/components/SosButton';
import { EventRow } from '@/components/EventRow';
import type { AppEvent, EventType } from '@/lib/supabase';

export function Home({ onNavigate }: { onNavigate: (s: 'places' | 'history' | 'settings') => void }) {
  const { connection, partnerName, events, places, quickMessages, online, queueCount, send, partnerLastEvent, myLastEvent, toggleKeepForever } = useAppData();
  const { profile } = useAuth();
  const [toast, setToast] = useState<{ msg: string; tone?: 'default' | 'danger' | 'success' } | null>(null);
  const [sendingType, setSendingType] = useState<string | null>(null);
  const [showLocationModal, setShowLocationModal] = useState<AppEvent | null>(null);

  const connected = connection?.status === 'accepted';

  const actions = useMemo<QuickAction[]>(() => {
    const custom = quickMessages.map((m) => ({
      type: 'CUSTOM' as EventType,
      emoji: m.emoji,
      label: m.label,
      message: m.message,
    }));
    const pinned = custom.slice(0, quickMessages.filter((m) => m.pinned).length);
    const rest = custom.slice(quickMessages.filter((m) => m.pinned).length);
    return [...pinned, ...DEFAULT_QUICK_ACTIONS, ...rest];
  }, [quickMessages]);

  async function handleAction(a: QuickAction) {
    setSendingType(a.type + a.label);
    const res = await send({ type: a.type, message: a.message, emoji: a.emoji });
    setSendingType(null);
    if (!res.ok) {
      setToast({ msg: res.error ?? 'Something went wrong', tone: 'danger' });
    } else if (res.offline) {
      setToast({ msg: 'Saved. We will send this when you are back online. ❤️', tone: 'default' });
    } else {
      setToast({ msg: 'Sent ❤️', tone: 'success' });
    }
    setTimeout(() => setToast(null), 2500);
  }

  const recent = events.slice(0, 5);

  if (!connected) {
    return (
      <div className="app-shell px-5 py-6">
        <Header onNavigate={onNavigate} online={online} queueCount={queueCount} />
        <div className="mt-8">
          <EmptyState
            icon="❤️"
            title="Not connected yet"
            subtitle="Create a pairing code or enter Aanya's code to start sharing quick messages."
            action={<Button onClick={() => onNavigate('settings')}>Go to settings</Button>}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell px-5 py-6">
      <Header onNavigate={onNavigate} online={online} queueCount={queueCount} />

      <section className="mt-4 fade-up">
        <PartnerStatus
          name={partnerName}
          lastEvent={partnerLastEvent}
        />
      </section>

      <section className="mt-5">
        <p className="px-1 pb-2 text-xs font-semibold uppercase tracking-wider text-muted">
          What do you want to say?
        </p>
        <div className="grid grid-cols-2 gap-3">
          {actions.map((a) => {
            const key = a.type + a.label;
            return (
              <button
                key={key}
                className="quick-tile"
                onClick={() => handleAction(a)}
                disabled={sendingType === key}
              >
                <span className="emoji">{sendingType === key ? '💬' : a.emoji}</span>
                <span className="text-xs font-medium leading-tight text-fg-soft">{a.label}</span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="mt-6">
        <SosButton onSent={(offline) => setToast({ msg: offline ? 'SOS saved. Waiting for connection.' : 'SOS sent. Aanya has been notified.', tone: offline ? 'default' : 'danger' })} />
      </section>

      <section className="mt-6">
        <div className="flex items-center justify-between px-1 pb-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted">Recent</p>
          {events.length > 0 && (
            <button className="text-xs font-medium text-accent" onClick={() => onNavigate('history')}>
              View all
            </button>
          )}
        </div>
        {recent.length === 0 ? (
          <p className="px-1 py-6 text-center text-sm text-muted">
            No messages yet. Tap one above to let Aanya know you are okay. ❤️
          </p>
        ) : (
          <div className="card divide-y divide-border overflow-hidden">
            {recent.map((e) => (
              <EventRow
                key={e.id}
                event={e}
                myId={profile?.id ?? ''}
                onShowLocation={(ev) => setShowLocationModal(ev)}
                onToggleKeepForever={(ev) => toggleKeepForever(ev.id)}
              />
            ))}
          </div>
        )}
      </section>

      <p className="mt-6 text-center text-xs text-muted">{rotatingMicrocopy()}</p>

      {toast && <Toast message={toast.msg} tone={toast.tone} />}
      {showLocationModal && (
        <LocationModal event={showLocationModal} onClose={() => setShowLocationModal(null)} />
      )}
    </div>
  );
}

function Header({
  onNavigate,
  online,
  queueCount,
}: {
  onNavigate: (s: 'places' | 'history' | 'settings') => void;
  online: boolean;
  queueCount: number;
}) {
  return (
    <header className="flex items-center justify-between">
      <div>
        <h1 className="text-xl">Aanya &amp; Me</h1>
        <p className="text-xs text-muted">
          {online ? 'Connected' : 'Offline'}{queueCount > 0 ? ` · ${queueCount} queued` : ''}
        </p>
      </div>
      <div className="flex items-center gap-1">
        <IconButton aria-label="Places" onClick={() => onNavigate('places')}>📍</IconButton>
        <IconButton aria-label="History" onClick={() => onNavigate('history')}>📜</IconButton>
        <IconButton aria-label="Settings" onClick={() => onNavigate('settings')}>⚙️</IconButton>
      </div>
    </header>
  );
}

function PartnerStatus({ name, lastEvent }: { name: string; lastEvent: AppEvent | null }) {
  const { profile } = useAuth();
  const myName = profile?.display_name ?? 'Me';
  return (
    <div className="card p-5">
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent-soft text-xl">
          {lastEvent?.emoji ?? '🟢'}
        </div>
        <div className="flex-1">
          <p className="text-sm font-medium">{name}</p>
          <p className="text-sm text-fg-soft">
            {lastEvent ? lastEvent.message : 'No update yet'}
          </p>
          <p className="text-xs text-muted">
            {lastEvent ? formatRelative(lastEvent.occurred_at) : 'Waiting for first message'}
          </p>
        </div>
      </div>
      <div className="mt-3 border-t border-border pt-3 text-xs text-muted">
        {greeting(myName)} ❤️
      </div>
    </div>
  );
}

function LocationModal({ event, onClose }: { event: AppEvent; onClose: () => void }) {
  return (
    <Modal open onClose={onClose} title="Shared location">
      {event.latitude != null && event.longitude != null ? (
        <div>
          <div className="overflow-hidden rounded-2xl border border-border">
            <iframe
              title="map"
              className="h-48 w-full"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              src={`https://www.openstreetmap.org/export/embed.html?marker=${event.latitude},${event.longitude}&bbox=${event.longitude - 0.01},${event.latitude - 0.01},${event.longitude + 0.01},${event.latitude + 0.01}`}
            />
          </div>
          <p className="mt-3 text-sm text-fg-soft">
            {event.emoji} {event.message}
          </p>
          <p className="mt-1 text-xs text-muted">
            Updated {formatTime(event.occurred_at)}
            {event.accuracy ? ` · ~${Math.round(event.accuracy)}m accuracy` : ''}
          </p>
          <a
            href={mapsLink(event.latitude, event.longitude)}
            target="_blank"
            rel="noreferrer"
            className="btn btn-outline mt-3 w-full"
          >
            Open in Maps
          </a>
        </div>
      ) : (
        <p className="text-sm text-muted">No location was attached to this message.</p>
      )}
    </Modal>
  );
}
