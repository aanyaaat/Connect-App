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
    joinConnection,
    arrivalDiagnostics,
  } = useAppData();
  const { profile } = useAuth();
  const [toast, setToast] = useState<{ msg: string; tone?: 'default' | 'danger' | 'success' } | null>(null);
  const [sendingType, setSendingType] = useState<string | null>(null);
  const [showLocationModal, setShowLocationModal] = useState<AppEvent | null>(null);
  const [particles, setParticles] = useState<Particle[]>([]);
  const [heartPulsing, setHeartPulsing] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [generatingCode, setGeneratingCode] = useState(false);
  const [partnerCodeInput, setPartnerCodeInput] = useState('');
  const [joiningCode, setJoiningCode] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);

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

  async function handleDirectJoin(e: React.FormEvent) {
    e.preventDefault();
    if (!partnerCodeInput.trim()) return;
    setJoiningCode(true);
    setJoinError(null);
    const res = await joinConnection(partnerCodeInput);
    setJoiningCode(false);
    if (res.error) {
      setJoinError(res.error);
    } else {
      setToast({ msg: 'Connected successfully! 🎉', tone: 'success' });
      setTimeout(() => setToast(null), 2500);
    }
  }

  const recent = events.slice(0, 4);

  // Screen when Not Yet Connected with Partner
  if (!connected) {
    return (
      <div className="app-shell px-5 pt-8 pb-32 flex flex-col justify-between overflow-y-auto">
        {/* Mobile / Desktop Header */}
        <header className="flex items-center justify-between pt-2">
          <div>
            <p className="text-xs font-semibold text-accent uppercase tracking-wider">
              {greeting(myName)}
            </p>
            <h1 className="text-2xl md:text-3xl text-fg font-serif">Aanya &amp; Me</h1>
          </div>
          <div className="flex items-center gap-1.5 rounded-full bg-accent-soft/80 border border-accent/20 px-3 py-1.5 text-xs text-accent font-semibold shadow-sm">
            <Radio className="h-3.5 w-3.5 animate-pulse" />
            <span>Waiting for Partner</span>
          </div>
        </header>

        {/* Responsive Desktop & Mobile 2-Column Pairing Grid */}
        <div className="my-auto py-6 fade-up grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl w-full mx-auto">
          {/* Card 1: Your Active Pairing Code */}
          <div className="card p-6 md:p-7 bg-gradient-to-br from-card via-card to-accent-soft/40 border-accent/30 text-center shadow-xl flex flex-col justify-between">
            <div>
              <span className="text-4xl mb-2 block animate-bounce">💌</span>
              <h2 className="text-xl font-serif font-bold text-fg">Your Pairing Code</h2>
              <p className="text-xs text-muted mt-1">
                Share this code with Aanya to link your accounts:
              </p>

              {activePairingCode ? (
                <div className="my-5 rounded-2xl bg-accent-soft/80 border border-accent/30 p-4 flex items-center justify-center gap-3 shadow-inner">
                  <span className="font-serif text-3xl md:text-4xl font-bold tracking-widest text-accent select-all">
                    {activePairingCode}
                  </span>
                  <button
                    onClick={() => copyCode(activePairingCode)}
                    className="flex h-11 w-11 items-center justify-center rounded-2xl bg-accent text-white shadow-md shadow-accent/30 active:scale-95 hover:scale-105 transition"
                    aria-label="Copy Code"
                  >
                    {copiedCode ? <Check className="h-5 w-5" /> : <Copy className="h-5 w-5" />}
                  </button>
                </div>
              ) : (
                <div className="my-5">
                  <Button onClick={handleGenerateCode} loading={generatingCode} className="w-full">
                    <Plus className="h-4 w-4" />
                    <span>Generate 6-Digit Code</span>
                  </Button>
                </div>
              )}
            </div>

            <div className="flex items-center justify-center gap-2 text-xs text-muted font-medium pt-2 border-t border-border/60">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>WebSockets active · Listening live for partner</span>
            </div>
          </div>

          {/* Card 2: Enter Partner's Code Directly */}
          <div className="card p-6 md:p-7 bg-gradient-to-br from-card to-bg-elev border-border/80 flex flex-col justify-between shadow-xl">
            <div>
              <span className="text-4xl mb-2 block">✨</span>
              <h2 className="text-xl font-serif font-bold text-fg">Enter Partner's Code</h2>
              <p className="text-xs text-muted mt-1 mb-5">
                Have Aanya's code? Enter it below to connect instantly:
              </p>

              <form onSubmit={handleDirectJoin} className="flex flex-col gap-3">
                <input
                  className="input uppercase tracking-wider text-center font-serif text-lg font-bold py-3"
                  placeholder="e.g. AANYA-7282"
                  value={partnerCodeInput}
                  onChange={(e) => setPartnerCodeInput(e.target.value)}
                />
                {joinError && (
                  <p className="text-xs text-danger font-semibold text-center">{joinError}</p>
                )}
                <Button type="submit" loading={joiningCode} className="w-full">
                  <span>Connect with Partner &rarr;</span>
                </Button>
              </form>
            </div>

            <p className="text-[11px] text-muted text-center pt-4 border-t border-border/60 mt-4">
              Works across Android, iPhone, Mac, Windows &amp; Web 💖
            </p>
          </div>
        </div>

        <p className="text-center text-xs text-muted pb-2">
          Private, end-to-end encrypted &amp; free forever for you two ❤️
        </p>

        {toast && <Toast message={toast.msg} tone={toast.tone} />}
      </div>
    );
  }

  // Screen when Connected (Responsive Desktop + Mobile Grid)
  return (
    <div className="app-shell px-5 pt-8 pb-32 flex flex-col gap-6 overflow-y-auto">
      {/* Top Header */}
      <header className="flex items-center justify-between pt-2">
        <div>
          <p className="text-xs font-semibold text-accent uppercase tracking-wider">
            {greeting(myName)}
          </p>
          <h1 className="text-2xl md:text-3xl text-fg font-serif">Aanya &amp; Me</h1>
        </div>
        <div className="flex items-center gap-2 rounded-full bg-card border border-border/80 px-4 py-2 shadow-sm text-xs font-medium">
          {online ? (
            <>
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-fg font-semibold">{partnerName}</span>
              <span className="text-muted hidden sm:inline">· Connected</span>
            </>
          ) : (
            <>
              <WifiOff className="h-3.5 w-3.5 text-muted" />
              <span className="text-muted">Offline {queueCount > 0 ? `(${queueCount})` : ''}</span>
            </>
          )}
        </div>
      </header>

      {/* Desktop Responsive Multi-Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 w-full items-start">
        {/* Main Column (7 cols on Desktop) */}
        <div className="lg:col-span-7 flex flex-col gap-5">
          {/* Main Interactive Heartbeat Centerpiece */}
          <section className="fade-up">
            <div className="card p-6 md:p-7 relative overflow-hidden bg-gradient-to-br from-card via-card to-accent-soft/30 border-accent/25 shadow-lg">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <span className="chip mb-2.5">
                    <Sparkles className="h-3.5 w-3.5" />
                    <span>Live Partner Status</span>
                  </span>
                  <h2 className="text-xl md:text-2xl text-fg font-serif">
                    {partnerLastEvent ? partnerLastEvent.message : `Waiting for ${partnerName}'s update`}
                  </h2>
                  <p className="text-xs text-muted mt-1.5 font-medium">
                    {partnerLastEvent
                      ? `${partnerLastEvent.emoji} ${formatRelative(partnerLastEvent.occurred_at)}`
                      : 'Tap the big heart below to poke!'}
                  </p>
                </div>
                <div className="text-5xl select-none p-2">
                  {partnerLastEvent?.emoji ?? '🌸'}
                </div>
              </div>

              {/* Big Poke / Send Heart Button */}
              <div className="mt-6 pt-5 border-t border-border/60 flex items-center justify-between relative">
                <div>
                  <p className="text-sm text-fg font-semibold">Send an instant heart poke:</p>
                  <p className="text-xs text-muted">Vibrates {partnerName}'s phone in real-time</p>
                </div>
                <div className="relative">
                  {/* Floating particles */}
                  {particles.map((p) => (
                    <div
                      key={p.id}
                      className="heart-particle text-3xl select-none"
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
                    className={`relative flex h-16 w-16 items-center justify-center rounded-3xl bg-accent text-white shadow-xl shadow-accent/35 transition-all duration-200 active:scale-90 hover:scale-105 ${
                      heartPulsing ? 'scale-125' : ''
                    }`}
                    aria-label="Send love"
                  >
                    <Heart className="h-8 w-8 fill-white animate-pulse" />
                  </button>
                </div>
              </div>
            </div>
          </section>

          {/* Quick Action Tiles (4 columns on Desktop md/lg!) */}
          <section className="fade-up">
            <p className="px-1 pb-2.5 text-xs font-bold uppercase tracking-wider text-muted flex items-center gap-1.5">
              <span>Quick Messages</span>
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
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
        </div>

        {/* Right Sidebar Column (5 cols on Desktop) */}
        <div className="lg:col-span-5 flex flex-col gap-5">
          {/* Arrival Detection Status Banner */}
          <div className="card p-5 bg-gradient-to-br from-card to-accent-soft/20 border-border/80">
            <div className="flex items-center justify-between">
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
                  Geofence Auto-Arrival
                </p>
              </div>
              <button
                onClick={() => onNavigate('places')}
                className="text-xs font-semibold text-accent hover:underline"
              >
                Manage &rarr;
              </button>
            </div>
            <p className="mt-2 text-xs text-muted font-medium">{arrivalDiagnostics.detail}</p>
          </div>

          {/* Recent Moments Journal */}
          <section className="fade-up">
            <div className="flex items-center justify-between px-1 pb-2">
              <p className="text-xs font-bold uppercase tracking-wider text-muted">Recent Moments</p>
              {events.length > 0 && (
                <button
                  className="text-xs font-semibold text-accent hover:underline"
                  onClick={() => onNavigate('history')}
                >
                  View all &rarr;
                </button>
              )}
            </div>
            {recent.length === 0 ? (
              <div className="card p-6 text-center">
                <span className="text-2xl mb-1 block">💌</span>
                <p className="text-xs text-muted">No messages yet. Send a heart above to start ❤️</p>
              </div>
            ) : (
              <div className="card divide-y divide-border/60 overflow-hidden shadow-sm">
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
        </div>
      </div>

      <p className="text-center text-xs text-muted pb-2">{rotatingMicrocopy()}</p>

      {toast && <Toast message={toast.msg} tone={toast.tone} />}
      {showLocationModal && (
        <LocationModal event={showLocationModal} onClose={() => setShowLocationModal(null)} />
      )}

      {/* Guaranteed Bottom Scroll Spacer so bottom nav never covers any button */}
      <div className="h-28 shrink-0 w-full md:hidden" aria-hidden="true" />
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
