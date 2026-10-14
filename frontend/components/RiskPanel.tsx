import type { AccountSnapshot } from '@/lib/types';
import { fmtUsd } from '@/lib/format';

const HIGH = 75;

export function RiskPanel({ risk, balanceUsd }: { risk: AccountSnapshot['risk']; balanceUsd: number }) {
  const high = risk.score > HIGH;
  const tone = high ? 'bg-down' : risk.level === 'elevated' ? 'bg-warn' : 'bg-up';
  const text = high ? 'text-down' : risk.level === 'elevated' ? 'text-warn' : 'text-up';

  return (
    <section
      aria-label="Risk indicator"
      className={`rounded-lg border p-4 ${high ? 'risk-pulse border-down bg-down/10' : 'border-ink-700 bg-ink-900'}`}
    >
      <div className="flex items-baseline justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-ink-400">Risk score</h2>
        <span className={`text-xs font-semibold uppercase tracking-wider ${text}`}>{risk.level}</span>
      </div>
      <div className="mt-2 flex items-end gap-2">
        <span className={`font-mono text-5xl font-bold tabular-nums ${text}`} data-testid="risk-score">
          {risk.score.toFixed(1)}
        </span>
        <span className="mb-1.5 font-mono text-ink-400">/ 100</span>
      </div>
      <div className="relative mt-3 h-2.5 overflow-hidden rounded-full bg-ink-700" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={risk.score}>
        <div className={`h-full ${tone} transition-[width] duration-500`} style={{ width: `${Math.min(100, risk.score)}%` }} />
        <div className="absolute inset-y-0 w-px bg-ink-100/60" style={{ left: `${HIGH}%` }} title="High-risk threshold (75)" />
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-2 font-mono text-xs text-ink-300">
        <div>
          <dt className="text-ink-400">Gross notional</dt>
          <dd className="tabular-nums">{fmtUsd(risk.grossNotionalUsd)}</dd>
        </div>
        <div className="text-right">
          <dt className="text-ink-400">Balance</dt>
          <dd className="tabular-nums">{risk.balanceUnavailable ? 'n/a' : fmtUsd(balanceUsd)}</dd>
        </div>
      </dl>
      {risk.balanceUnavailable && risk.grossNotionalUsd > 0 && (
        <p className="mt-2 text-xs text-down">Account balance is zero with an open position: risk pinned at 100.</p>
      )}
    </section>
  );
}

/** Full-width banner so a >75 score cannot be missed even when scrolled past the gauge. */
export function HighRiskBanner({ score, accountNumber }: { score: number; accountNumber: string }) {
  if (score <= HIGH) return null;
  return (
    <div role="alert" className="risk-pulse flex items-center gap-3 rounded-lg border border-down bg-down px-4 py-3 font-semibold text-white">
      <span aria-hidden className="text-xl">▲</span>
      <span className="uppercase tracking-wide">High risk</span>
      <span className="font-normal">
        Account {accountNumber} exposure is at <span className="font-mono font-bold">{score.toFixed(1)}</span> of balance (threshold 75).
      </span>
    </div>
  );
}
