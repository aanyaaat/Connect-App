import { useState, useEffect, useRef } from 'react';
import { X, ArrowLeft, Heart, Sparkles, Trash2, Play, Pause, Clock } from 'lucide-react';
import { useAppData } from '@/context/AppDataContext';
import { useAuth } from '@/context/AuthContext';
import type { EphemeralStatus } from '@/lib/supabase';

interface StatusViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  status: EphemeralStatus | null;
}

export function StatusViewerModal({ isOpen, onClose, status }: StatusViewerModalProps) {
  const { user } = useAuth();
  const { partnerName, deleteEphemeralStatus, send } = useAppData();
  const [isPlayingAudio, setIsPlayingAudio] = useState(true);
  const [timeLeftMinutes, setTimeLeftMinutes] = useState(60);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Calculate remaining time
  useEffect(() => {
    if (!status) return;
    const updateRemaining = () => {
      const diffMs = new Date(status.expires_at).getTime() - Date.now();
      const mins = Math.max(0, Math.round(diffMs / (60 * 1000)));
      setTimeLeftMinutes(mins);
    };
    updateRemaining();
    const interval = setInterval(updateRemaining, 30000);
    return () => clearInterval(interval);
  }, [status]);

  if (!isOpen || !status) return null;

  const isMyStatus = status.user_id === user?.id;

  const handleSendHeartReaction = () => {
    send({
      type: 'CUSTOM',
      emoji: '💖',
      message: `Reacted with ❤️ to your 1-hour Glance!`,
    });
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate([60, 40, 60]);
      } catch {}
    }
  };

  const handleDelete = async () => {
    await deleteEphemeralStatus(status.id);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[130] bg-black/95 backdrop-blur-2xl flex flex-col justify-between p-4 text-white animate-fade-in select-none">
      {/* Top Bar with Time Left and Controls */}
      <div className="w-full flex items-center justify-between z-20">
        <button
          onClick={onClose}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-2xl bg-white/10 hover:bg-white/20 active:scale-95 text-white font-semibold text-xs transition-all"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back</span>
        </button>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 bg-rose-500/20 border border-rose-500/30 px-3 py-1 rounded-full text-xs font-semibold text-rose-200">
            <Clock className="w-3.5 h-3.5 text-rose-400" />
            <span>{timeLeftMinutes}m left</span>
          </div>

          {isMyStatus && (
            <button
              onClick={handleDelete}
              className="p-2 rounded-full bg-red-500/20 text-red-300 hover:bg-red-500/30 active:scale-95"
              title="Delete Glance"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>

        <button
          onClick={onClose}
          className="p-2 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 text-white"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Main Viewer */}
      <div className="flex-1 flex flex-col items-center justify-center my-auto relative w-full max-w-sm mx-auto overflow-hidden">
        {status.type === 'PHOTO' && (
          <img
            src={status.media_url}
            alt="Glance"
            className="max-h-[65vh] w-full object-contain rounded-3xl shadow-2xl border border-white/10"
          />
        )}

        {status.type === 'VIDEO' && (
          <video
            src={status.media_url}
            autoPlay
            loop
            playsInline
            className="max-h-[65vh] w-full object-contain rounded-3xl shadow-2xl border border-white/10"
          />
        )}

        {status.type === 'VOICE' && (
          <div className="w-full py-16 px-6 rounded-3xl bg-gradient-to-br from-rose-950/80 via-purple-950/80 to-card border border-rose-500/30 shadow-2xl flex flex-col items-center justify-center gap-4 text-center">
            <audio
              ref={audioRef}
              src={status.media_url}
              autoPlay
              onEnded={() => setIsPlayingAudio(false)}
              className="hidden"
            />
            <div className="relative">
              {isPlayingAudio && (
                <div className="absolute inset-0 bg-pink-500/30 rounded-full animate-ping pointer-events-none" />
              )}
              <button
                onClick={() => {
                  if (isPlayingAudio) {
                    audioRef.current?.pause();
                    setIsPlayingAudio(false);
                  } else {
                    audioRef.current?.play();
                    setIsPlayingAudio(true);
                  }
                }}
                className="w-20 h-20 rounded-full bg-gradient-to-tr from-pink-500 to-rose-500 text-white flex items-center justify-center shadow-xl shadow-rose-500/40 active:scale-95 relative z-10"
              >
                {isPlayingAudio ? <Pause className="w-8 h-8" /> : <Play className="w-8 h-8 ml-1" />}
              </button>
            </div>
            <h3 className="text-base font-bold text-rose-100 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-rose-400" />
              {isMyStatus ? 'Your Voice Glance' : `${partnerName}'s Voice Glance`}
            </h3>
            <p className="text-xs text-rose-200/60">
              {status.duration ? `${status.duration} seconds love note` : 'Voice recording'}
            </p>
          </div>
        )}

        {/* Optional Caption */}
        {status.caption && (
          <div className="mt-4 px-4 py-2 rounded-2xl bg-black/60 backdrop-blur-md border border-white/15 text-sm text-center font-medium text-white shadow-lg">
            {status.caption}
          </div>
        )}
      </div>

      {/* Bottom Footer Reaction & Actions */}
      <div className="w-full flex items-center justify-between pb-2 z-20">
        <span className="text-xs text-white/50">
          Posted by {isMyStatus ? 'You' : partnerName}
        </span>

        {!isMyStatus && (
          <button
            onClick={handleSendHeartReaction}
            className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600 active:scale-95 text-white font-bold text-xs shadow-lg shadow-rose-500/40 transition-all"
          >
            <Heart className="w-4 h-4 fill-white" />
            <span>Send Love Reaction</span>
          </button>
        )}
      </div>
    </div>
  );
}
