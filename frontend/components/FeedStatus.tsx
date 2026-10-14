import { fmtTime } from '@/lib/format';
import type { FeedStatus } from '@/hooks/useLiveSnapshot';

const STYLES: Record<FeedStatus, { label: string; dot: string; text: string }> = {
  live: { label: 'LIVE', dot: 'bg-up', text: 'text-up' },
  connecting: { label: 'CONNECTING', dot: 'bg-ink-400', text: 'text-ink-300' },
  resyncing: { label: 'RESYNCING', dot: 'bg-warn', text: 'text-warn' },
  disconnected: { label: 'STALE', dot: 'bg-down', text: 'text-down' },
  unauthorized: { label: 'SIGNED OUT', dot: 'bg-down', text: 'text-down' },
};

export function FeedStatusPill({ status }: { status: FeedStatus }) {
  const s = STYLES[status];
  return (
    <span className={`inline-flex items-center gap-2 rounded-full border border-ink-700 bg-ink-900 px-3 py-1 font-mono text-[11px] font-semibold ${s.text}`} aria-live="polite">
      <span className={`h-2 w-2 rounded-full ${s.dot} ${status === 'live' ? 'animate-pulse' : ''}`} />
      {s.label}
    </span>
  );
}

export function StaleBanner({ status, lastUpdate }: { status: FeedStatus; lastUpdate: string }) {
  if (status !== 'disconnected' && status !== 'resyncing') return null;
  const at = fmtTime(lastUpdate);
  return (
    <div role="status" className="rounded-lg border border-warn/60 bg-warn/10 px-4 py-2.5 text-sm text-warn">
      {status === 'disconnected'
        ? `Live feed disconnected. Figures below are the last known values (as of ${at}) and may be stale. Reconnecting…`
        : 'Feed reconnected. Re-syncing the snapshot to pick up any fills missed while offline…'}
    </div>
  );
}
