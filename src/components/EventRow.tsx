import { formatTime, formatRelative } from '@/lib/format';
import type { AppEvent } from '@/lib/supabase';

export function EventRow({
  event,
  myId,
  partnerName,
  onShowLocation,
  onAck,
  onToggleKeepForever,
  onDelete,
}: {
  event: AppEvent;
  myId: string;
  partnerName?: string;
  onShowLocation?: (e: AppEvent) => void;
  onAck?: (e: AppEvent) => void;
  onToggleKeepForever?: (e: AppEvent) => void;
  onDelete?: (e: AppEvent) => void;
}) {
  const mine = event.sender_id === myId;
  const hasLocation = event.latitude != null && event.longitude != null;
  const isSos = event.type === 'SOS';

  return (
    <div className={`flex items-start gap-3 p-4 group ${isSos ? 'bg-danger-soft/40' : ''}`}>
      <span className="text-xl leading-none">{event.emoji}</span>
      <div className="flex-1">
        <p className="text-sm font-medium">
          {mine ? 'You' : (partnerName || 'Partner')}: <span className="font-normal text-fg-soft">{event.message}</span>
        </p>
        <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted">
          <span>{formatTime(event.occurred_at)}</span>
          <span>· {formatRelative(event.occurred_at)}</span>
          {event.keep_forever && <span className="text-amber-500 font-semibold">⭐ Saved</span>}
          {event.created_offline && <span>· saved offline</span>}
          {event.delivery_status === 'queued' && <span>· queued</span>}
        </div>
      </div>
      <div className="flex flex-col items-end gap-1.5">
        <div className="flex items-center gap-2">
          {onToggleKeepForever && (
            <button
              className={`text-xs transition-opacity ${event.keep_forever ? 'text-amber-500 opacity-100' : 'text-muted opacity-40 hover:opacity-100'}`}
              onClick={() => onToggleKeepForever(event)}
              title={event.keep_forever ? 'Saved memory (will not be auto-deleted)' : 'Save memory forever'}
              aria-label="Save memory"
            >
              {event.keep_forever ? '⭐' : '☆'}
            </button>
          )}
          {hasLocation && (
            <button
              className="text-xs font-medium text-accent hover:underline"
              onClick={() => onShowLocation?.(event)}
            >
              📍 View
            </button>
          )}
          {onDelete && (
            <button
              className="text-xs text-muted opacity-40 group-hover:opacity-100 hover:text-danger hover:opacity-100 transition-all"
              onClick={() => onDelete(event)}
              title="Delete moment"
              aria-label="Delete moment"
            >
              🗑️
            </button>
          )}
        </div>
        {!mine && event.delivery_status !== 'acked' && onAck && (
          <button
            className="text-xs font-medium text-accent"
            onClick={() => onAck(event)}
          >
            ❤️ Ack
          </button>
        )}
      </div>
    </div>
  );
}
