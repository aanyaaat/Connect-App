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
import { Heart, Sparkles, Copy, Check, MapPin, Radio, WifiOff, Plus } from 'lucide-react';

interface Particle {
  id: number;
  x: number;
  rot: number;
}

export function Home({ onNavigate }: { onNavigate: (s: 'places' | 'history' | 'settings') => void }) {
  const {
    connection,
    partnerName,
    events,
    quickMessages,
    online,
    queueCount,
    send,
    partnerLastEvent,
    toggleKeepForever,
    createConnection,
  } = useAppData();
  const { profile } = useAuth();
  const [toast, setToast] = useState<{ msg: string; tone?: 'default' | 'danger' | 'success' } | null>(null);
  const [sendingType, setSendingType] = useState<string | null>(null);
  const [showLocationModal, setShowLocationModal] = useState<AppEvent | null>(null);
  const [particles, setParticles] = useState<Particle[]>([]);
  const [heartPulsing, setHeartPulsing] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [generatingCode, setGeneratingCode] = useState(false);

  const connected = connection?.status === 'accepted';
  const myName = profile?.display_name ?? 'You';
  const activePairingCode =
    connection?.pairing_code || localStorage.getItem('aanya_active_code') || null;

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

  function copyCode(c: string) {
    navigator.clipboard?.writeText(c);
    setCopiedCode(true);
    setToast({ msg: 'Pairing code copied to clipboard! 📋', tone: 'success' });
    setTimeout(() => setCopiedCode(false), 2000);
    setTimeout(() => setToast(null), 2500);
  }

  async function handleGenerateCode() {
    setGeneratingCode(true);
    const res = await createConnection();
    setGeneratingCode(false);
    if (res.error) {
      setToast({ msg: res.error, tone: 'danger' });
    } else if (res.code) {
      setToast({ msg: `Generated code: ${res.code} 💌`, tone: 'success' });
    }
    setTimeout(() => setToast(null), 2500);
  }

  const recent = events.slice(0, 4);

  // Screen when Not Yet Connected with Partner
  if (!connected) {
    return (
      <div className="app-shell px-5 py-6 flex flex-col justify-between">
        {/* Header */}
        <header className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-accent uppercase tracking-wider">
              {greeting(myName)}
            </p>
            <h1 className="text-2xl text-fg font-serif">Aanya &amp; Me</h1>
          </div>
          <div className="flex items-center gap-1.5 rounded-full bg-accent-soft px-3 py-1.5 text-xs text-accent font-semibold">
            <Radio className="h-3.5 w-3.5 animate-pulse" />
            <span>Pairing</span>
          </div>
        </header>

        {/* Prominent Always-Visible Pairing Code Card */}
        <div className="my-auto fade-up flex flex-col gap-4">
          {activePairingCode ? (
            <div className="card p-5 bg-gradient-to-br from-card via-card to-accent-soft/40 border-accent/30 text-center shadow-lg">
              <span className="text-3xl mb-1 block">💌</span>
              <h2 className="text-lg font-serif font-bold text-fg">Your Active Pairing Code</h2>
              <p className="text-xs text-muted mt-0.5">
                Share this code with Aanya to connect in real time:
              </p>

              <div className="my-4 rounded-2xl bg-accent-soft/70 border border-accent/30 p-3.5 flex items-center justify-center gap-3">
                <span className="font-serif text-3xl font-bold tracking-widest text-accent select-all">
                  {activePairingCode}
                </span>
                <button
                  onClick={() => copyCode(activePairingCode)}
                  className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent text-white shadow-md active:scale-95 transition"
                  aria-label="Copy Code"
                >
                  {copiedCode ? <Check className="h-5 w-5" /> : <Copy className="h-5 w-5" />}
                </button>
              </div>

              <div className="flex items-center justify-center gap-2 text-xs text-muted font-medium">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>Listening live for Aanya to join...</span>
              </div>
            </div>
          ) : (
            <div className="card p-5 text-center">
              <span className="text-3xl mb-2 block">✨</span>
              <h2 className="text-lg font-serif font-bold text-fg">No Pairing Code Active</h2>
              <p className="text-xs text-muted mt-1 mb-4">
                Generate a 6-digit code or enter your partner's code to connect.
              </p>
              <Button onClick={handleGenerateCode} loading={generatingCode} className="w-full">
                <Plus className="h-4 w-4" />
                <span>Generate Pairing Code</span>
              </Button>
            </div>
          )}

          <div className="flex flex-col gap-2">
            <Button
              variant="outline"
              onClick={() => onNavigate('settings')}
              className="w-full"
            >
              Enter Aanya's Code in Settings &rarr;
            </Button>
          </div>
        </div>

        <p className="text-center text-[11px] text-muted pb-2">
          Private, encrypted &amp; free forever for you two ❤️
        </p>

        {toast && <Toast message={toast.msg} tone={toast.tone} />}
      </div>
    );
  }

  // Screen when Connected
  return (
    <div className="app-shell px-5 py-6 flex flex-col gap-5">
      {/* Top Header */}
      <header className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold text-accent uppercase tracking-wider">
            {greeting(myName)}
          </p>
          <h1 className="text-2xl text-fg font-serif">Aanya &amp; Me</h1>
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
