import { useState, useEffect, useRef, useCallback } from 'react';
import { Heart, Activity, Sparkles, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useAppData } from '@/context/AppDataContext';

interface HeartbeatTouchProps {
  isOpen: boolean;
  onClose: () => void;
}

export function HeartbeatTouch({ isOpen, onClose }: HeartbeatTouchProps) {
  const { user } = useAuth();
  const { connection, partnerName } = useAppData();
  const [isHolding, setIsHolding] = useState(false);
  const [incomingBeat, setIncomingBeat] = useState(false);
  const [pulseCount, setPulseCount] = useState(0);
  const holdIntervalRef = useRef<any>(null);
  const channelRef = useRef<any>(null);

  // Subscribe to live heartbeat broadcast channel
  useEffect(() => {
    if (!connection || !user) return;

    const channel = supabase.channel(`heartbeat_${connection.id}`);
    channel
      .on('broadcast', { event: 'heartbeat_pulse' }, (payload) => {
        if (payload.payload?.sender_id !== user.id) {
          // Trigger matching physical haptic on partner's phone
          if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
            try {
              navigator.vibrate([70, 40, 70]);
            } catch {}
          }
          setIncomingBeat(true);
          setPulseCount((c) => c + 1);
          setTimeout(() => setIncomingBeat(false), 600);
        }
      })
      .subscribe();

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
    };
  }, [connection, user]);

  const sendBeat = useCallback(() => {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate([80, 30, 80]);
      } catch {}
    }
    setPulseCount((c) => c + 1);
    if (channelRef.current && user) {
      channelRef.current.send({
        type: 'broadcast',
        event: 'heartbeat_pulse',
        payload: { sender_id: user.id, time: Date.now() },
      });
    }
  }, [user]);

  const handleStartHold = () => {
    setIsHolding(true);
    sendBeat();
    holdIntervalRef.current = setInterval(() => {
      sendBeat();
    }, 850); // Natural human heart rate ~70 BPM
  };

  const handleEndHold = () => {
    setIsHolding(false);
    if (holdIntervalRef.current) {
      clearInterval(holdIntervalRef.current);
      holdIntervalRef.current = null;
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[120] bg-black/85 backdrop-blur-xl flex flex-col items-center justify-between p-6 animate-fade-in text-white select-none">
      {/* Header */}
      <div className="w-full flex items-center justify-between pt-4">
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-rose-500 animate-pulse" />
          <span className="text-sm font-semibold tracking-wide uppercase text-rose-300">
            Live Heartbeat Touch
          </span>
        </div>
        <button
          onClick={onClose}
          className="p-2.5 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 transition-all text-white"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Main Interactive Touchpad */}
      <div className="flex flex-col items-center justify-center my-auto relative w-full max-w-sm">
        {/* Glowing Pulsing Rings */}
        <div
          className={`absolute rounded-full transition-all duration-700 pointer-events-none ${
            isHolding || incomingBeat
              ? 'w-72 h-72 bg-rose-500/25 blur-2xl scale-125'
              : 'w-48 h-48 bg-rose-500/10 blur-xl scale-90'
          }`}
        />

        {/* Dynamic Ripple Rings */}
        {(isHolding || incomingBeat) && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-64 h-64 border-2 border-rose-400/40 rounded-full animate-ping" />
            <div className="w-80 h-80 border border-rose-300/20 rounded-full animate-pulse" />
          </div>
        )}

        {/* Center Touch Heart */}
        <button
          onPointerDown={handleStartHold}
          onPointerUp={handleEndHold}
          onPointerLeave={handleEndHold}
          className={`relative z-10 w-44 h-44 rounded-full flex flex-col items-center justify-center transition-all duration-300 shadow-2xl ${
            isHolding
              ? 'bg-gradient-to-tr from-rose-600 to-pink-500 scale-95 shadow-rose-500/50'
              : incomingBeat
              ? 'bg-gradient-to-tr from-pink-500 to-purple-600 scale-110 shadow-pink-500/50'
              : 'bg-gradient-to-tr from-rose-950/80 to-purple-950/80 border border-rose-500/30 hover:border-rose-400/60 active:scale-95'
          }`}
        >
          <Heart
            className={`w-20 h-20 transition-transform duration-300 ${
              isHolding
                ? 'text-white fill-white scale-110 animate-bounce'
                : incomingBeat
                ? 'text-pink-200 fill-pink-200 scale-125'
                : 'text-rose-400 fill-rose-500/30'
            }`}
          />
          <span className="text-xs font-medium tracking-wider text-rose-200/90 mt-2">
            {isHolding ? 'SENDING...' : incomingBeat ? 'FEELING IT...' : 'HOLD TO FEEL'}
          </span>
        </button>

        {/* Status Text */}
        <div className="mt-8 text-center">
          <h3 className="text-xl font-bold tracking-tight text-rose-100 flex items-center justify-center gap-2">
            <Sparkles className="w-4 h-4 text-rose-400" />
            {incomingBeat
              ? `${partnerName} is sending a heartbeat!`
              : isHolding
              ? `Pulsing on ${partnerName}'s phone...`
              : `Hold your finger to pulse ${partnerName}'s phone`}
          </h3>
          <p className="text-xs text-rose-200/60 mt-1.5 max-w-xs">
            Vibrates in the exact natural rhythm of your touch across the distance.
          </p>
        </div>
      </div>

      {/* Footer Info */}
      <div className="w-full text-center pb-4 text-xs text-white/40">
        Total Pulses Sent & Felt: <span className="text-rose-400 font-semibold">{pulseCount}</span>
      </div>
    </div>
  );
}
