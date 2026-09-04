import { useEffect, useMemo, useState } from 'react';
import { useAppData } from '@/context/AppDataContext';
import { useAuth } from '@/context/AuthContext';
import { DEFAULT_QUICK_ACTIONS, type QuickAction } from '@/lib/quickActions';
import { formatRelative, formatTime, greeting, rotatingMicrocopy } from '@/lib/format';
import { mapsLink } from '@/lib/location';
import { Button, EmptyState, Modal, Toast } from '@/components/ui';
import { SosButton } from '@/components/SosButton';
import { EventRow } from '@/components/EventRow';
import { HeartbeatTouch } from '@/components/HeartbeatTouch';
import { DoodleCanvas } from '@/components/DoodleCanvas';
import { EphemeralStatusModal } from '@/components/EphemeralStatusModal';
import { StatusViewerModal } from '@/components/StatusViewerModal';
import type { AppEvent, EventType, EphemeralStatus } from '@/lib/supabase';
import { Heart, Sparkles, Copy, Check, MapPin, Radio, WifiOff, Plus, Activity, Pen, Battery, Zap, Mic, Camera } from 'lucide-react';

interface Particle {
  id: number;
  x: number;
  rot: number;
}

export function Home({ onNavigate }: { onNavigate: (s: 'places' | 'history' | 'settings') => void }) {
  const {
    connection,
    partnerName,
    partnerProfile,
    events,
    quickMessages,
    online,
    queueCount,
    send,
    partnerLastEvent,
    partnerStatus,
    myStatus,
    toggleKeepForever,
    deleteEvent,
    createConnection,
    joinConnection,
    arrivalDiagnostics,
  } = useAppData();
  const { profile } = useAuth();
  const [toast, setToast] = useState<{ msg: string; tone?: 'default' | 'danger' | 'success' } | null>(null);
  const [sendingType, setSendingType] = useState<string | null>(null);
  const [showLocationModal, setShowLocationModal] = useState<AppEvent | null>(null);
  const [showHeartbeatModal, setShowHeartbeatModal] = useState(false);
  const [showDoodleModal, setShowDoodleModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [viewingStatus, setViewingStatus] = useState<EphemeralStatus | null>(null);
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

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('screen') === 'doodle' || window.location.hash === '#doodle') {
      setShowDoodleModal(true);
    }
  }, []);

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
    if (res.ok) {
      setToast({ msg: `Sent "${a.label}" to ${partnerName}! ${a.emoji}`, tone: 'success' });
    } else {
      setToast({ msg: res.error ?? 'Failed to send', tone: 'danger' });
    }
    setTimeout(() => setToast(null), 2500);
  }

  async function handleGenerateCode() {
    setGeneratingCode(true);
    const res = await createConnection();
    setGeneratingCode(false);
    if (res.code) {
      setToast({ msg: `New pairing code generated: ${res.code}`, tone: 'success' });
    } else {
      setToast({ msg: res.error ?? 'Failed to create connection code.', tone: 'danger' });
    }
    setTimeout(() => setToast(null), 3000);
  }

  async function handleDirectJoin(e: React.FormEvent) {
    e.preventDefault();
    if (!partnerCodeInput.trim()) {
      setJoinError('Please enter a valid pairing code.');
      return;
    }
    setJoinError(null);
    setJoiningCode(true);
    const res = await joinConnection(partnerCodeInput);
    setJoiningCode(false);
    if (res.ok) {
      setToast({ msg: 'Connected successfully with your partner! ❤️', tone: 'success' });
    } else {
      setJoinError(res.error ?? 'Invalid pairing code. Please double check.');
    }
    setTimeout(() => setToast(null), 3000);
  }

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(true);
    setToast({ msg: 'Pairing code copied to clipboard!', tone: 'success' });
    setTimeout(() => {
      setCopiedCode(false);
      setToast(null);
    }, 2000);
  };

  const recent = events.slice(0, 5);

  // Screen when Not Yet Connected (Onboarding Pairing Hub)
  if (!connected) {
    return (
      <div className="app-shell px-5 pt-8 pb-32 flex flex-col gap-6 overflow-y-auto max-w-4xl mx-auto w-full">
        <header className="text-center pt-2">
          <p className="text-xs font-bold text-accent uppercase tracking-widest">
            {greeting(myName)}
          </p>
          <h1 className="text-3xl md:text-4xl text-fg font-serif mt-1">Connect with Partner</h1>
          <p className="text-xs text-muted mt-1.5 max-w-md mx-auto">
            Pair your devices using your private 6-digit code.
          </p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 w-full">
          <div className="card p-6 md:p-7 bg-gradient-to-br from-card via-card to-accent-soft/30 border-accent/30 flex flex-col justify-between shadow-xl">
            <div>
              <span className="chip mb-2">
                <Radio className="h-3 w-3 text-accent animate-pulse" />
                <span>Device Code</span>
              </span>
              <h2 className="text-xl font-serif font-bold text-fg">Your Pairing Code</h2>
              <p className="text-xs text-muted mt-1 mb-4">
                Share this code with your partner to link your phones:
              </p>

              {activePairingCode ? (
                <div className="my-5 flex items-center justify-between rounded-2xl bg-bg-elev p-4 border border-accent/40 shadow-inner">
                  <span className="font-serif text-2xl md:text-3xl font-extrabold tracking-widest text-accent select-all">
                    {activePairingCode}
                  </span>
                  <button
                    onClick={() => copyCode(activePairingCode)}
                    className="flex h-11 w-11 items-center justify-center rounded-2xl bg-accent text-white shadow-md shadow-accent/30 active:scale-95 hover:scale-105 transition"
                  >
                    {copiedCode ? <Check className="h-5 w-5" /> : <Copy className="h-5 w-5" />}
                  </button>
                </div>
              ) : (
                <div className="my-5">
                  <Button onClick={handleGenerateCode} loading={generatingCode} className="w-full">
                    <Plus className="h-4 w-4" />
                    <span>Generate Code</span>
                  </Button>
                </div>
              )}
            </div>
          </div>

          <div className="card p-6 md:p-7 bg-gradient-to-br from-card to-bg-elev border-border/80 flex flex-col justify-between shadow-xl">
            <div>
              <span className="chip mb-2">
                <Sparkles className="h-3 w-3 text-accent" />
                <span>Join</span>
              </span>
              <h2 className="text-xl font-serif font-bold text-fg">Enter Partner's Code</h2>
              <p className="text-xs text-muted mt-1 mb-5">
                Have your partner's code? Enter it below to connect:
              </p>

              <form onSubmit={handleDirectJoin} className="flex flex-col gap-3">
                <input
                  className="input uppercase tracking-wider text-center font-serif text-lg font-bold py-3"
                  placeholder="e.g. LOVE-7282"
                  value={partnerCodeInput}
                  onChange={(e) => setPartnerCodeInput(e.target.value)}
                />
                {joinError && (
                  <p className="text-xs text-danger font-semibold text-center">{joinError}</p>
                )}
                <Button type="submit" loading={joiningCode} className="w-full">
                  <span>Connect Now &rarr;</span>
                </Button>
              </form>
            </div>
          </div>
        </div>
        {toast && <Toast message={toast.msg} tone={toast.tone} />}
      </div>
    );
  }

  return (
    <div className="app-shell px-5 pt-4 pb-44 flex flex-col gap-5">
      {/* Redesigned Responsive Header (Never truncates or overflows) */}
      <header className="flex flex-col gap-1.5 pt-2">
        {/* Top Info Bar: Greeting on Left, Battery & Live Indicator on Right */}
        <div className="flex items-center justify-between gap-2">
          <p className="text-[11px] font-bold text-accent uppercase tracking-wider truncate">
            {greeting(myName)}
          </p>

          <div className="flex items-center gap-2 shrink-0">
            {partnerProfile?.battery_level != null && (
              <div className="flex items-center gap-1.5 rounded-full bg-card border border-border/80 px-2.5 py-1 shadow-sm text-[11px] font-semibold">
                {partnerProfile.is_charging ? (
                  <Zap className="h-3 w-3 text-amber-500 fill-amber-500 animate-pulse" />
                ) : (
                  <Battery className="h-3 w-3 text-emerald-500" />
                )}
                <span className="text-fg">{partnerProfile.battery_level}%</span>
              </div>
            )}

            {/* Live Indicator Pill */}
            <div className="flex items-center gap-1.5 rounded-full bg-card/95 border border-accent/40 px-2.5 py-1 shadow-sm text-[11px] font-semibold">
              {online ? (
                <>
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-emerald-400 font-bold">LIVE</span>
                </>
              ) : (
                <>
                  <WifiOff className="h-3 w-3 text-muted" />
                  <span className="text-muted text-[10px]">OFFLINE</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Main Title & Partner Connection Banner */}
        <div className="flex items-center justify-between gap-2">
          <div>
            <h1 className="text-2xl sm:text-3xl text-fg font-serif whitespace-nowrap">
              Aanya &amp; Me
            </h1>
            <p className="text-xs text-muted font-medium flex items-center gap-1 mt-0.5">
              {partnerName ? (
                <>
                  <span>Connected with</span>
                  <span className="text-accent font-bold">{partnerName}</span>
                  <span>❤️</span>
                </>
              ) : (
                'Private Couple Space'
              )}
            </p>
          </div>
        </div>
      </header>

      {/* 1-Hour Live Glance Stories Section */}
      <div className="card p-4 bg-gradient-to-br from-card via-card to-accent-soft/20 border border-border/70 shadow-md flex flex-col gap-3">
        <div className="flex items-center justify-between pb-1 border-b border-border/50">
          <div className="flex items-center gap-2">
            <span className="text-sm">⏱️</span>
            <span className="text-xs font-bold uppercase tracking-wider text-fg font-serif">1-Hour Live Glances</span>
          </div>
          <span className="text-[10px] font-semibold text-muted bg-bg-elev px-2 py-0.5 rounded-full border border-border/60">
            Auto-clears in 1h
          </span>
        </div>

        {/* Story Bubbles Row */}
        <div className="grid grid-cols-2 gap-3 py-1">
          {/* 1. YOUR GLANCE CARD */}
          <button
            onClick={() => {
              if (myStatus) {
                setViewingStatus(myStatus);
              } else {
                setShowStatusModal(true);
              }
            }}
            className={`p-3 rounded-2xl border transition-all flex flex-col items-center gap-2 text-center group active:scale-98 ${
              myStatus
                ? 'bg-gradient-to-b from-rose-950/30 to-card border-rose-500/40 shadow-sm shadow-rose-500/10'
                : 'bg-bg-elev/70 border-border/70 hover:border-accent/60'
            }`}
          >
            <div
              className={`relative w-14 h-14 rounded-full p-0.5 transition-all ${
                myStatus
                  ? 'bg-gradient-to-tr from-rose-500 via-pink-500 to-purple-500 shadow-md shadow-rose-500/30 scale-105'
                  : 'border-2 border-dashed border-border/80 group-hover:border-accent'
              }`}
            >
              <div className="w-full h-full rounded-full bg-card flex items-center justify-center overflow-hidden">
                {myStatus?.type === 'PHOTO' ? (
                  <img src={myStatus.media_url} alt="My status" className="w-full h-full object-cover" />
                ) : myStatus?.type === 'VIDEO' ? (
                  <video src={myStatus.media_url} className="w-full h-full object-cover" />
                ) : myStatus?.type === 'VOICE' ? (
                  <Mic className="w-6 h-6 text-pink-400 animate-pulse" />
                ) : (
                  <Camera className="w-6 h-6 text-muted group-hover:text-accent transition-colors" />
                )}
              </div>
              {!myStatus && (
                <div className="absolute bottom-0 right-0 w-4.5 h-4.5 rounded-full bg-accent text-white flex items-center justify-center text-xs font-bold border-2 border-bg shadow-sm">
                  +
                </div>
              )}
            </div>
            <div>
              <p className="text-xs font-bold text-fg">Your Glance</p>
              <p className="text-[10px] text-muted font-medium mt-0.5">
                {myStatus ? 'Tap to view / manage' : '+ Add moment'}
              </p>
            </div>
          </button>

          {/* 2. PARTNER'S GLANCE CARD */}
          <button
            onClick={() => {
              if (partnerStatus) {
                setViewingStatus(partnerStatus);
              }
            }}
            disabled={!partnerStatus}
            className={`p-3 rounded-2xl border transition-all flex flex-col items-center gap-2 text-center ${
              partnerStatus
                ? 'bg-gradient-to-b from-purple-950/40 to-card border-purple-500/50 shadow-lg shadow-purple-500/20 active:scale-98 cursor-pointer animate-pulse'
                : 'bg-bg-elev/40 border-border/40 opacity-60 cursor-default'
            }`}
          >
            <div
              className={`relative w-14 h-14 rounded-full p-0.5 transition-all ${
                partnerStatus
                  ? 'bg-gradient-to-tr from-rose-500 via-purple-500 to-pink-500 shadow-lg shadow-pink-500/40 ring-2 ring-rose-400 scale-105'
                  : 'border border-border/60'
              }`}
            >
              <div className="w-full h-full rounded-full bg-card flex items-center justify-center overflow-hidden">
                {partnerStatus?.type === 'PHOTO' ? (
                  <img src={partnerStatus.media_url} alt="Partner status" className="w-full h-full object-cover" />
                ) : partnerStatus?.type === 'VIDEO' ? (
                  <video src={partnerStatus.media_url} className="w-full h-full object-cover" />
                ) : partnerStatus?.type === 'VOICE' ? (
                  <Mic className="w-6 h-6 text-rose-400 animate-pulse" />
                ) : (
                  <span className="text-xl">❤️</span>
                )}
              </div>
              {partnerStatus && (
                <div className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-rose-500 border-2 border-bg animate-ping" />
              )}
            </div>
            <div>
              <p className="text-xs font-bold text-fg flex items-center justify-center gap-1">
                <span>{partnerName}'s Glance</span>
                {partnerStatus && <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />}
              </p>
              <p className="text-[10px] font-semibold mt-0.5">
                {partnerStatus ? (
                  <span className="text-rose-400 font-bold">✨ Tap to View</span>
                ) : (
                  <span className="text-muted">No active glance</span>
                )}
              </p>
            </div>
          </button>
        </div>

        {/* Prominent Banner if Partner posted a Glance */}
        {partnerStatus && (
          <button
            onClick={() => setViewingStatus(partnerStatus)}
            className="w-full p-3 rounded-2xl bg-gradient-to-r from-rose-500/25 via-purple-500/25 to-pink-500/25 border border-rose-400/60 flex items-center justify-between shadow-md active:scale-98 transition-all group"
          >
            <div className="flex items-center gap-2.5">
              <span className="text-xl">📸</span>
              <div className="text-left">
                <p className="text-xs font-bold text-fg flex items-center gap-1.5">
                  <span>{partnerName} shared a Glance!</span>
                  <span className="text-[9px] bg-rose-500 text-white px-2 py-0.5 rounded-full font-bold">
                    VIEW
                  </span>
                </p>
                <p className="text-[10px] text-muted">Tap to see their photo, video, or voice note</p>
              </div>
            </div>
            <span className="text-xs text-accent font-bold group-hover:translate-x-1 transition-transform">
              &rarr;
            </span>
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => setShowHeartbeatModal(true)}
          className="card p-4 bg-gradient-to-br from-rose-950/40 via-card to-card border-rose-500/30 hover:border-rose-500/60 active:scale-98 transition-all flex items-center gap-3 shadow-md group"
        >
          <div className="w-10 h-10 rounded-2xl bg-rose-500/20 flex items-center justify-center text-rose-500 group-hover:scale-110 transition-transform">
            <Activity className="w-5 h-5 animate-pulse" />
          </div>
          <div className="text-left">
            <h3 className="text-xs font-bold uppercase tracking-wider text-rose-300">Live Touch</h3>
            <p className="text-[11px] text-muted font-medium">Apple Watch Haptics</p>
          </div>
        </button>

        <button
          onClick={() => setShowDoodleModal(true)}
          className="card p-4 bg-gradient-to-br from-purple-950/40 via-card to-card border-purple-500/30 hover:border-purple-500/60 active:scale-98 transition-all flex items-center gap-3 shadow-md group"
        >
          <div className="w-10 h-10 rounded-2xl bg-purple-500/20 flex items-center justify-center text-purple-400 group-hover:scale-110 transition-transform">
            <Pen className="w-5 h-5" />
          </div>
          <div className="text-left">
            <h3 className="text-xs font-bold uppercase tracking-wider text-purple-300">Live Doodle</h3>
            <p className="text-[11px] text-muted font-medium">Real-Time Canvas</p>
          </div>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 w-full items-start">
        <div className="lg:col-span-7 flex flex-col gap-5">
          <section className="fade-up">
            <div className="card p-6 md:p-7 relative overflow-hidden bg-gradient-to-br from-card via-card to-accent-soft/30 border-accent/25 shadow-lg">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <span className="chip mb-2.5 border-accent/40 bg-accent/15 text-accent font-bold">
                    <Sparkles className="h-3.5 w-3.5" />
                    <span>Partner: {partnerName}</span>
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

              <div className="mt-6 pt-5 border-t border-border/60 flex items-center justify-between relative">
                <div>
                  <p className="text-sm text-fg font-semibold">Send an instant heart poke:</p>
                  <p className="text-xs text-muted">Vibrates {partnerName}'s phone in real-time</p>
                </div>
                <div className="relative">
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

        <div className="lg:col-span-5 flex flex-col gap-5">
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
                    partnerName={partnerName}
                    onShowLocation={(ev) => setShowLocationModal(ev)}
                    onToggleKeepForever={(ev) => toggleKeepForever(ev.id)}
                    onDelete={(ev) => deleteEvent(ev.id)}
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
      <HeartbeatTouch isOpen={showHeartbeatModal} onClose={() => setShowHeartbeatModal(false)} />
      <DoodleCanvas isOpen={showDoodleModal} onClose={() => setShowDoodleModal(false)} />
      <EphemeralStatusModal isOpen={showStatusModal} onClose={() => setShowStatusModal(false)} />
      <StatusViewerModal
        isOpen={Boolean(viewingStatus)}
        status={viewingStatus}
        onClose={() => setViewingStatus(null)}
      />

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
