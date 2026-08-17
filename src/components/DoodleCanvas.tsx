import { useState, useEffect, useRef, useCallback } from 'react';
import { Pen, Trash2, Send, X, Palette, Undo, Sparkles } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useAppData } from '@/context/AppDataContext';

interface DoodleCanvasProps {
  isOpen: boolean;
  onClose: () => void;
}

const COLORS = [
  '#f43f5e', // Rose Red
  '#ec4899', // Pink
  '#a855f7', // Neon Violet
  '#38bdf8', // Electric Sky
  '#f59e0b', // Amber Sunset
  '#10b981', // Emerald
  '#ffffff', // Pure White
];

export function DoodleCanvas({ isOpen, onClose }: DoodleCanvasProps) {
  const { user } = useAuth();
  const { connection, partnerName, send } = useAppData();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [color, setColor] = useState('#f43f5e');
  const [lineWidth, setLineWidth] = useState(4);
  const [isDrawing, setIsDrawing] = useState(false);
  const [partnerDrawing, setPartnerDrawing] = useState(false);
  const lastPosRef = useRef<{ x: number; y: number } | null>(null);
  const channelRef = useRef<any>(null);

  // Set up real-time bidirectional doodle channel
  useEffect(() => {
    if (!connection || !user) return;

    const channel = supabase.channel(`doodle_${connection.id}`);
    channel
      .on('broadcast', { event: 'doodle_stroke' }, ({ payload }) => {
        if (payload.sender_id !== user.id) {
          drawRemoteStroke(payload.stroke);
          setPartnerDrawing(true);
          setTimeout(() => setPartnerDrawing(false), 500);
        }
      })
      .on('broadcast', { event: 'doodle_clear' }, ({ payload }) => {
        if (payload.sender_id !== user.id) {
          clearLocalCanvas();
        }
      })
      .subscribe();

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
    };
  }, [connection, user]);

  // Adjust canvas resolution for high DPI displays
  useEffect(() => {
    if (!isOpen || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.scale(dpr, dpr);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.fillStyle = '#0f0a17';
      ctx.fillRect(0, 0, rect.width, rect.height);
    }
  }, [isOpen]);

  const drawRemoteStroke = (stroke: {
    fromX: number;
    fromY: number;
    toX: number;
    toY: number;
    color: string;
    size: number;
  }) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    ctx.strokeStyle = stroke.color;
    ctx.lineWidth = stroke.size;
    ctx.beginPath();
    ctx.moveTo(stroke.fromX * rect.width, stroke.fromY * rect.height);
    ctx.lineTo(stroke.toX * rect.width, stroke.toY * rect.height);
    ctx.stroke();
  };

  const clearLocalCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    ctx.fillStyle = '#0f0a17';
    ctx.fillRect(0, 0, rect.width, rect.height);
  };

  const handleClear = () => {
    clearLocalCanvas();
    if (channelRef.current && user) {
      channelRef.current.send({
        type: 'broadcast',
        event: 'doodle_clear',
        payload: { sender_id: user.id },
      });
    }
  };

  const getCanvasCoords = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0, normX: 0, normY: 0 };
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    return {
      x,
      y,
      normX: x / rect.width,
      normY: y / rect.height,
    };
  };

  const startDrawing = (e: React.PointerEvent<HTMLCanvasElement>) => {
    setIsDrawing(true);
    const coords = getCanvasCoords(e);
    lastPosRef.current = { x: coords.x, y: coords.y };
  };

  const draw = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !lastPosRef.current || !canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    const coords = getCanvasCoords(e);
    const rect = canvasRef.current.getBoundingClientRect();

    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.beginPath();
    ctx.moveTo(lastPosRef.current.x, lastPosRef.current.y);
    ctx.lineTo(coords.x, coords.y);
    ctx.stroke();

    // Broadcast stroke to partner
    if (channelRef.current && user) {
      channelRef.current.send({
        type: 'broadcast',
        event: 'doodle_stroke',
        payload: {
          sender_id: user.id,
          stroke: {
            fromX: lastPosRef.current.x / rect.width,
            fromY: lastPosRef.current.y / rect.height,
            toX: coords.normX,
            toY: coords.normY,
            color,
            size: lineWidth,
          },
        },
      });
    }

    lastPosRef.current = { x: coords.x, y: coords.y };
  };

  const stopDrawing = () => {
    setIsDrawing(false);
    lastPosRef.current = null;
  };

  const handleSendAsMoment = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    try {
      await send({
        type: 'CUSTOM',
        emoji: '🎨',
        message: 'Sent a live shared drawing ❤️',
      });
      onClose();
    } catch {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[120] bg-black/90 backdrop-blur-2xl flex flex-col justify-between p-4 text-white select-none">
      {/* Top Header */}
      <div className="w-full flex items-center justify-between pb-3">
        <div className="flex items-center gap-2">
          <Pen className="w-5 h-5 text-rose-500" />
          <span className="text-sm font-bold tracking-wide uppercase text-rose-300">
            Live Doodle Canvas
          </span>
          {partnerDrawing && (
            <span className="text-xs bg-rose-500/20 text-rose-300 px-2 py-0.5 rounded-full border border-rose-500/40 animate-pulse flex items-center gap-1">
              <Sparkles className="w-3 h-3" /> {partnerName} is drawing...
            </span>
          )}
        </div>
        <button
          onClick={onClose}
          className="p-2 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 text-white"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Main Drawing Canvas */}
      <div className="flex-1 w-full relative rounded-2xl overflow-hidden border border-white/15 shadow-2xl bg-[#0f0a17] touch-none">
        <canvas
          ref={canvasRef}
          onPointerDown={startDrawing}
          onPointerMove={draw}
          onPointerUp={stopDrawing}
          onPointerLeave={stopDrawing}
          className="w-full h-full cursor-crosshair"
        />
      </div>

      {/* Bottom Toolset */}
      <div className="w-full flex flex-col gap-3 pt-3">
        {/* Colors & Brush Size */}
        <div className="flex items-center justify-between gap-2 overflow-x-auto py-1">
          <div className="flex items-center gap-2">
            {COLORS.map((c) => (
              <button
                key={c}
                onClick={() => setColor(c)}
                className={`w-7 h-7 rounded-full transition-transform ${
                  color === c ? 'scale-125 ring-2 ring-white ring-offset-2 ring-offset-black' : 'opacity-80 hover:opacity-100'
                }`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>

          <div className="flex items-center gap-1.5 bg-white/10 p-1 rounded-xl">
            {[2, 5, 10].map((s) => (
              <button
                key={s}
                onClick={() => setLineWidth(s)}
                className={`w-7 h-7 flex items-center justify-center rounded-lg text-xs font-semibold ${
                  lineWidth === s ? 'bg-rose-500 text-white' : 'text-white/60 hover:text-white'
                }`}
              >
                {s === 2 ? 'S' : s === 5 ? 'M' : 'L'}
              </button>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleClear}
            className="flex-1 py-3 bg-white/10 hover:bg-white/15 active:scale-98 rounded-xl font-medium text-sm flex items-center justify-center gap-2 text-rose-300 transition-all"
          >
            <Trash2 className="w-4 h-4" /> Clear Canvas
          </button>
          <button
            onClick={handleSendAsMoment}
            className="flex-[2] py-3 bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500 active:scale-98 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 text-white shadow-lg shadow-rose-600/30 transition-all"
          >
            <Send className="w-4 h-4" /> Send to Timeline
          </button>
        </div>
      </div>
    </div>
  );
}
