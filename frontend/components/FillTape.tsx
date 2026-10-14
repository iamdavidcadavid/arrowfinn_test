import type { LiveFill } from '@/hooks/useLiveSnapshot';
import { fmtPrice, fmtTime } from '@/lib/format';

export function FillTape({ fills }: { fills: LiveFill[] }) {
  return (
    <section aria-label="Live fills" className="rounded-lg border border-ink-700 bg-ink-900">
      <header className="border-b border-ink-700 px-4 py-2.5">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-ink-400">Live fills</h2>
      </header>
      {fills.length === 0 ? (
        <p className="px-4 py-6 text-center text-xs text-ink-400">Waiting for fills on the live feed…</p>
      ) : (
        <ul className="max-h-80 divide-y divide-ink-800 overflow-y-auto font-mono text-xs tabular-nums">
          {fills.map((f) => (
            <li key={f.seq} className="flash-in grid grid-cols-[auto_1fr_auto] items-center gap-3 px-4 py-2">
              <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${f.side === 'BUY' ? 'bg-up/15 text-up' : 'bg-down/15 text-down'}`}>
                {f.side}
              </span>
              <span className="text-ink-100">
                {f.quantity} {f.symbol} @ {fmtPrice(f.price)}
                <span className="ml-2 text-ink-400">{f.accountId}</span>
              </span>
              <span className="text-ink-400">{fmtTime(f.filledAt)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
