import type { AccountSnapshot } from '@/lib/types';
import { fmtSignedUsd, pnlClass } from '@/lib/format';

function Card({ label, value, emphasis = false, neutral = false }: { label: string; value: number; emphasis?: boolean; neutral?: boolean }) {
  return (
    <div className={`rounded-lg border border-ink-700 bg-ink-900 p-4 ${emphasis ? 'sm:col-span-2' : ''}`}>
      <div className="text-xs font-semibold uppercase tracking-widest text-ink-400">{label}</div>
      <div className={`mt-1 font-mono font-semibold tabular-nums ${emphasis ? 'text-4xl' : 'text-2xl'} ${neutral ? 'text-ink-100' : pnlClass(value)}`}>
        {fmtSignedUsd(value)}
      </div>
    </div>
  );
}

export function PnlCards({ pnl }: { pnl: AccountSnapshot['pnl'] }) {
  return (
    <section aria-label="Day P&L" className="grid grid-cols-2 gap-3 sm:grid-cols-5">
      <Card label="Day P&L (net)" value={pnl.netUsd} emphasis />
      <Card label="Realized" value={pnl.realizedUsd} />
      <Card label="Unrealized" value={pnl.unrealizedUsd} />
      <Card label="Commissions" value={-pnl.commissionsUsd} neutral />
    </section>
  );
}
