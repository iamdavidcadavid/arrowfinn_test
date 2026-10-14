import type { PositionView } from '@/lib/types';
import { fmtPrice, fmtSignedUsd, fmtUsd, pnlClass } from '@/lib/format';

export function PositionsTable({ positions, flashKey }: { positions: PositionView[]; flashKey: string | null }) {
  return (
    <section aria-label="Open positions" className="rounded-lg border border-ink-700 bg-ink-900">
      <header className="flex items-center justify-between border-b border-ink-700 px-4 py-2.5">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-ink-400">Open positions</h2>
        <span className="font-mono text-xs text-ink-400">{positions.length}</span>
      </header>
      {positions.length === 0 ? (
        <p className="px-4 py-10 text-center text-sm text-ink-400">Flat. No open positions in this account.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full font-mono text-sm tabular-nums">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wider text-ink-400">
                <th className="px-4 py-2 font-medium">Instrument</th>
                <th className="px-4 py-2 text-right font-medium">Net qty</th>
                <th className="px-4 py-2 text-right font-medium">Avg price</th>
                <th className="px-4 py-2 text-right font-medium">Mark</th>
                <th className="px-4 py-2 text-right font-medium">Notional</th>
                <th className="px-4 py-2 text-right font-medium">Unrealized</th>
              </tr>
            </thead>
            <tbody>
              {positions.map((p) => (
                // key includes flashKey so the row re-mounts (and flashes) on a live update
                <tr key={`${p.symbol}:${flashKey}`} className={`border-t border-ink-800 ${flashKey ? 'flash-in' : ''}`}>
                  <td className="px-4 py-2.5">
                    <div className="font-semibold text-ink-100">{p.symbol}</div>
                    <div className="font-sans text-xs text-ink-400">{p.description} · ${p.pointValueUsd.toLocaleString()}/pt</div>
                  </td>
                  <td className={`px-4 py-2.5 text-right font-semibold ${p.netQty > 0 ? 'text-up' : 'text-down'}`}>
                    {p.netQty > 0 ? `+${p.netQty}` : p.netQty}
                    <span className="ml-1 text-[10px] text-ink-400">{p.netQty > 0 ? 'LONG' : 'SHORT'}</span>
                  </td>
                  <td className="px-4 py-2.5 text-right">{fmtPrice(p.avgPrice)}</td>
                  <td className="px-4 py-2.5 text-right">{fmtPrice(p.markPrice)}</td>
                  <td className="px-4 py-2.5 text-right text-ink-300">{fmtUsd(p.notionalUsd)}</td>
                  <td className={`px-4 py-2.5 text-right font-semibold ${pnlClass(p.unrealizedPnlUsd)}`}>{fmtSignedUsd(p.unrealizedPnlUsd)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
