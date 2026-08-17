import { useEffect, useRef, useState } from 'react';
import { useAppData } from '@/context/AppDataContext';
import { getCurrentPosition } from '@/lib/location';

export function SosButton({ onSent }: { onSent: (offline: boolean) => void }) {
  const { send, connection } = useAppData();
  const [holding, setHolding] = useState(false);
  const [countdown, setCountdown] = useState(2);
  const [sending, setSending] = useState(false);
  const timer = useRef<number | null>(null);
  const interval = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
      if (interval.current) clearInterval(interval.current);
    };
  }, []);

  async function fire() {
    setSending(true);
    const coords = await getCurrentPosition();
    const res = await send({
      type: 'SOS',
      message: 'I may need help.',
      emoji: '🚨',
      attachLocation: true,
    });
    setSending(false);
    setHolding(false);
    onSent(res.offline);
    void coords;
  }

  function startHold() {
    if (!connection || connection.status !== 'accepted') return;
    setHolding(true);
    setCountdown(2);
    interval.current = window.setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          if (interval.current) clearInterval(interval.current);
          fire();
          return 0;
        }
        return c - 1;
      });
    }, 1000);
  }

  function cancelHold() {
    if (interval.current) clearInterval(interval.current);
    if (timer.current) clearTimeout(timer.current);
    setHolding(false);
    setCountdown(2);
  }

  return (
    <div className="flex flex-col items-center">
      <button
        onPointerDown={startHold}
        onPointerUp={cancelHold}
        onPointerLeave={cancelHold}
        disabled={sending || !connection || connection.status !== 'accepted'}
        className={`relative flex h-28 w-28 items-center justify-center rounded-full bg-danger text-white shadow-lg transition-transform ${
          holding ? 'scale-110 sos-pulse' : 'hover:scale-105'
        } disabled:opacity-40`}
        aria-label="Hold to send SOS"
      >
        {sending ? (
          <span className="text-sm font-semibold">Sending…</span>
        ) : holding ? (
          <span className="text-2xl font-bold">{countdown}</span>
        ) : (
          <span className="text-xl font-bold tracking-wide">SOS</span>
        )}
      </button>
      <p className="mt-3 text-xs text-muted">
        {holding ? 'Release to cancel' : 'Press and hold to send'}
      </p>
    </div>
  );
}
