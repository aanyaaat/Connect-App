import { useEffect, useMemo, useState } from 'react';
import { useAppData } from '@/context/AppDataContext';
import { useAuth } from '@/context/AuthContext';
import { DEFAULT_QUICK_ACTIONS, type QuickAction } from '@/lib/quickActions';
import { formatRelative, formatTime, greeting, rotatingMicrocopy } from '@/lib/format';
import { mapsLink } from '@/lib/location';
import { Button, EmptyState, Modal, Toast } from '@/components/ui';
import { SosButton } from '@/components/SosButton';
import { EventRow } from '@/components/EventRow';
import type { AppEvent, EventType } from '@/lib/supabase';
import { Heart, Sparkles, Send, MapPin, Radio, Wifi, WifiOff } from 'lucide-react';

interface Particle {
  id: number;
  x: number;
  rot: number;
}

export function Home({ onNavigate }: { onNavigate: (s: 'places' | 'history' | 'settings') => void }) {
  const { connection, partnerName, events, quickMessages, online, queueCount, send, partnerLastEvent, toggleKeepForever } = useAppData();
  const { profile } = useAuth();
  const [toast, setToast] = useState<{ msg: string; tone?: 'default' | 'danger' | 'success' } | null>(null);
  const [sendingType, setSendingType] = useState<string | null>(null);
  const [showLocationModal, setShowLocationModal] = useState<AppEvent | null>(null);
  const [particles, setParticles] = useState<Particle[]>([]);
  const [heartPulsing, setHeartPulsing] = useState(false);

  const connected = connection?.status === 'accepted';
  const myName = profile?.display_name ?? 'You';

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

  function triggerHeartEffect() {
    setHeartPulsing(true);
    setTimeout(() => setHeartPulsing(false), 300);

    const count = 5;
    const newParticles: Particle[] = Array.from({ length: count }, (_, i) => ({
      id: Date.now() + i,
      x: (Math.random() - 0.5) * 120,
      rot: (Math.random() - 0.5) * 60,
    }));

    setParticles((prev) => [...prev, ...newParticles]);
    setTimeout(() => {
      setParticles((prev) => prev.filter((p) => !newParticles.find((np) => np.id === p.id)));
    }, 1200);
  }

  async function handleSendLove() {
    triggerHeartEffect();
    setSendingType('LOVE');
    const res = await send({
      type: 'READY',
      message: 'Thinking of you right now ❤️',
      emoji: '💖',
    });
    setSendingType(null);
    if (res.ok) {
      setToast({ msg: `Sent a heart to ${partnerName}! 💖`, tone: 'success' });
    } else {
      setToast({ msg: res.error ?? 'Failed to send', tone: 'danger' });
    }
    setTimeout(() => setToast(null), 2500);
  }

  async function handleAction(a: QuickAction) {
    setSendingType(a.type + a.label);
    const res = await send({ type: a.type, message: a.message, emoji: a.emoji });
    setSendingType(null);
    if (!res.ok) {
      setToast({ msg: res.error ?? 'Something went wrong', tone: 'danger' });
    } else if (res.offline) {
      setToast({ msg: 'Saved offline. We will send this when reconnected. ❤️', tone: 'default' });
    } else {
      setToast({ msg: `Sent to ${partnerName} ❤️`, tone: 'success' });
    }
    setTimeout(() => setToast(null), 2500);
  }

  const recent = events.slice(0, 4);

  if (!connected) {
    return (
      <div className="app-shell px-5 py-6">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl text-fg">Aanya &amp; Me</h1>
            <p className="text-xs text-muted">Private connection for two ❤️</p>
          </div>
          <div className="flex items-center gap-1.5 rounded-full bg-accent-soft px-3 py-1 text-xs text-accent font-medium">
            <Radio className="h-3.5 w-3.5 animate-pulse" />
            <span>Pairing</span>
          </div>
        </header>

        <div className="my-auto fade-up">
          <EmptyState
            icon="💌"
            title="Not connected yet"
            subtitle="Share your pairing code with Aanya or enter her code in settings to start sending real-time messages!"
            action={
              <Button size="lg" onClick={() => onNavigate('settings')} className="w-full">
                Go to Connection Settings
              </Button>
            }
          />
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell px-5 py-6 flex flex-col gap-5">
      {/* Top Header */}
      <header className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold text-accent uppercase tracking-wider">
            {greeting(myName)}
          </p>
          <h1 className="text-2xl text-fg">Aanya &amp; Me</h1>
        </div>
        <div className="flex items-center gap-1.5 rounded-full bg-card border border-border/80 px-3 py-1.5 shadow-sm text-xs font-medium">
          {online ? (
            <>
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-fg-soft font-semibold">{partnerName}</span>
            </>
          ) : (
            <>
              <WifiOff className="h-3.5 w-3.5 text-muted" />
              <span className="text-muted">Offline {queueCount > 0 ? `(${queueCount})` : ''}</span>
            </>
          )}
        </div>
      </header>

      {/* Main Interactive Heartbeat Centerpiece */}
      <section className="fade-up">
        <div className="card p-5 relative overflow-hidden bg-gradient-to-br from-card via-card to-accent-soft/30 border-accent/20">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <span className="chip mb-2">
                <Sparkles className="h-3 w-3" />
                <span>Live Partner Status</span>
              </span>
              <h2 className="text-lg text-fg font-serif">
                {partnerLastEvent ? partnerLastEvent.message : `Waiting for ${partnerName}'s update`}
              </h2>
              <p className="text-xs text-muted mt-1 font-medium">
                {partnerLastEvent
                  ? `${partnerLastEvent.emoji} ${formatRelative(partnerLastEvent.occurred_at)}`
                  : 'Tap the big heart below to poke!'}
              </p>
            </div>
            <div className="text-4xl select-none p-2">
              {partnerLastEvent?.emoji ?? '🌸'}
            </div>
          </div>

          {/* Big Poke / Send Heart Button */}
          <div className="mt-5 pt-4 border-t border-border/60 flex items-center justify-between relative">
            <p className="text-xs text-fg-soft font-medium">Send an instant heart poke:</p>
            <div className="relative">
              {/* Floating particles */}
              {particles.map((p) => (
                <div
                  key={p.id}
                  className="heart-particle text-2xl select-none"
                  style={{
                    left: '50%',
                    top: '0%',
                    ['--tx' as any]: `${p.x}px`,
                    ['--rot' as any]: `${p.rot}deg`,
                  }}
                >
                  💖
                </div>
              ))}
              <button
                onClick={handleSendLove}
                disabled={sendingType === 'LOVE'}
                className={`relative flex h-14 w-14 items-center justify-center rounded-3xl bg-accent text-white shadow-lg shadow-accent/35 transition-all duration-200 active:scale-90 hover:scale-105 ${
                  heartPulsing ? 'scale-125' : ''
                }`}
                aria-label="Send love"
              >
                <Heart className="h-7 w-7 fill-white animate-pulse" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Quick Action Tiles */}
      <section className="fade-up">
        <p className="px-1 pb-2.5 text-xs font-bold uppercase tracking-wider text-muted flex items-center gap-1.5">
          <span>Quick Messages</span>
        </p>
        <div className="grid grid-cols-2 gap-3">
          {actions.map((a) => {
            const key = a.type + a.label;
            const isSending = sendingType === key;
            return (
              <button
                key={key}
                className="quick-tile"
                onClick={() => handleAction(a)}
                disabled={isSending}
              >
                <span className="emoji">{isSending ? '💌' : a.emoji}</span>
                <span className="text-xs font-semibold leading-tight text-fg-soft">{a.label}</span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Emergency SOS Bar */}
      <section className="fade-up">
        <SosButton
          onSent={(offline) =>
            setToast({
              msg: offline
                ? 'SOS saved offline. Waiting for connection.'
                : `🚨 SOS sent! ${partnerName} has been alerted with your location.`,
              tone: offline ? 'default' : 'danger',
            })
          }
        />
      </section>

      {/* Recent Moments Journal */}
      <section className="fade-up">
        <div className="flex items-center justify-between px-1 pb-2">
          <p className="text-xs font-bold uppercase tracking-wider text-muted">Recent Moments</p>
          {events.length > 0 && (
            <button
              className="text-xs font-semibold text-accent hover:underline"
              onClick={() => onNavigate('history')}
            >
              View all moments &rarr;
            </button>
          )}
        </div>
        {recent.length === 0 ? (
          <div className="card p-5 text-center">
            <p className="text-xs text-muted">No messages yet. Send a heart above to start ❤️</p>
          </div>
        ) : (
          <div className="card divide-y divide-border/60 overflow-hidden">
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

      <p className="text-center text-[11px] text-muted pb-2">{rotatingMicrocopy()}</p>

      {toast && <Toast message={toast.msg} tone={toast.tone} />}
      {showLocationModal && (
        <LocationModal event={showLocationModal} onClose={() => setShowLocationModal(null)} />
      )}
    </div>
  );
}

function LocationModal({ event, onClose }: { event: AppEvent; onClose: () => void }) {
  return (
    <Modal open onClose={onClose} title="Shared Location">
      {event.latitude != null && event.longitude != null ? (
        <div className="flex flex-col gap-3">
          <div className="overflow-hidden rounded-2xl border border-border/80 shadow-sm">
            <iframe
              title="map"
              className="h-48 w-full"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              src={`https://www.openstreetmap.org/export/embed.html?marker=${event.latitude},${event.longitude}&bbox=${event.longitude - 0.01},${event.latitude - 0.01},${event.longitude + 0.01},${event.latitude + 0.01}`}
            />
          </div>
          <div className="rounded-2xl bg-bg-elev p-3 border border-border/60">
            <p className="text-sm font-semibold text-fg">
              {event.emoji} {event.message}
            </p>
            <p className="mt-0.5 text-xs text-muted">
              Logged at {formatTime(event.occurred_at)}
              {event.accuracy ? ` · ~${Math.round(event.accuracy)}m accuracy` : ''}
            </p>
          </div>
          <a
            href={mapsLink(event.latitude, event.longitude)}
            target="_blank"
            rel="noreferrer"
            className="btn btn-outline w-full"
          >
            <MapPin className="h-4 w-4 text-accent" />
            <span>Open in Google Maps</span>
          </a>
        </div>
      ) : (
        <p className="text-xs text-muted">No location coordinates attached to this moment.</p>
      )}
    </Modal>
  );
}
