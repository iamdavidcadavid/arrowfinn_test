'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useLiveSnapshot } from '@/hooks/useLiveSnapshot';
import { ApiError, api } from '@/lib/api';
import { fmtSession, fmtTime } from '@/lib/format';
import type { AccountSnapshot } from '@/lib/types';
import { FeedStatusPill, StaleBanner } from '@/components/FeedStatus';
import { HighRiskBanner, RiskPanel } from '@/components/RiskPanel';
import { PnlCards } from '@/components/PnlCards';
import { PositionsTable } from '@/components/PositionsTable';
import { FillTape } from '@/components/FillTape';

export default function SnapshotPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { query, status, fills } = useLiveSnapshot();
  const [selected, setSelected] = useState<string | null>(null);

  const unauthorized = status === 'unauthorized' || (query.error instanceof ApiError && query.error.status === 401);
  useEffect(() => {
    if (unauthorized) router.replace('/login');
  }, [unauthorized, router]);

  const snapshot = query.data;
  const account: AccountSnapshot | undefined = useMemo(() => {
    if (!snapshot?.accounts.length) return undefined;
    return snapshot.accounts.find((a) => a.accountId === selected) ?? snapshot.accounts[0];
  }, [snapshot, selected]);

  async function logout() {
    await api.logout().catch(() => undefined);
    queryClient.clear();
    router.replace('/login');
  }

  if (query.isPending || unauthorized) return <LoadingState />;
  if (query.isError && !snapshot) return <ErrorState message={query.error.message} onRetry={() => query.refetch()} />;
  if (!snapshot) return <LoadingState />;

  const stale = status !== 'live';
  const highRiskAccounts = snapshot.accounts.filter((a) => a.risk.score > 75);

  return (
    <main className="mx-auto max-w-7xl space-y-4 px-4 py-5 sm:px-6">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-ink-800 pb-4">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-ink-400">
            {snapshot.trader.brokerName} · {snapshot.trader.brokerType === 'prop' ? 'Prop' : 'Retail'}
          </div>
          <h1 className="text-xl font-semibold">Daily snapshot · {snapshot.trader.displayName}</h1>
          <div className="mt-0.5 font-mono text-xs text-ink-400">
            Session {fmtSession(snapshot.session.start)} → {fmtSession(snapshot.session.end)} · as of {fmtTime(snapshot.asOf)}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <FeedStatusPill status={status} />
          <button onClick={logout} className="rounded-md border border-ink-700 px-3 py-1.5 text-xs text-ink-300 hover:bg-ink-800">
            Sign out
          </button>
        </div>
      </header>

      <StaleBanner status={status} lastUpdate={snapshot.asOf} />
      {query.isError && (
        <div role="status" className="rounded-lg border border-down/60 bg-down/10 px-4 py-2.5 text-sm text-down">
          Could not refresh the snapshot ({query.error.message}). Showing last known values.
        </div>
      )}

      {highRiskAccounts.map((a) => (
        <HighRiskBanner key={a.accountId} score={a.risk.score} accountNumber={a.accountNumber} />
      ))}

      {!account ? (
        <EmptyState />
      ) : (
        <>
          {snapshot.accounts.length > 1 && (
            <nav aria-label="Accounts" className="flex flex-wrap gap-2">
              {snapshot.accounts.map((a) => {
                const active = a.accountId === account.accountId;
                return (
                  <button
                    key={a.accountId}
                    onClick={() => setSelected(a.accountId)}
                    aria-pressed={active}
                    className={`rounded-md border px-3 py-1.5 text-left font-mono text-xs ${
                      active ? 'border-sky-500 bg-sky-500/10 text-ink-100' : 'border-ink-700 bg-ink-900 text-ink-300 hover:bg-ink-800'
                    }`}
                  >
                    {a.accountNumber}
                    <span className="ml-2 uppercase text-ink-400">{a.accountType}</span>
                    {a.status !== 'active' && <span className="ml-2 uppercase text-warn">{a.status}</span>}
                    {a.risk.score > 75 && <span className="ml-2 font-bold text-down">▲ {a.risk.score.toFixed(1)}</span>}
                  </button>
                );
              })}
            </nav>
          )}

          {account.status !== 'active' && (
            <div className="rounded-lg border border-warn/60 bg-warn/10 px-4 py-2 text-sm text-warn">
              This account is <strong className="uppercase">{account.status}</strong>.
            </div>
          )}
          {account.accountType === 'demo' && (
            <div className="rounded-lg border border-ink-700 bg-ink-900 px-4 py-2 text-xs text-ink-300">Demo account: simulated funds.</div>
          )}

          <div className={`grid gap-4 transition-opacity lg:grid-cols-[1fr_320px] ${stale ? 'opacity-60' : ''}`}>
            <div className="space-y-4">
              <PnlCards pnl={account.pnl} />
              <PositionsTable positions={account.positions} flashKey={account.lastFillSeq} />
              <p className="font-mono text-[11px] text-ink-400">
                {account.fillsToday} fills this session · P&L in USD, net of commissions · marks as of dataset cut
              </p>
            </div>
            <aside className="space-y-4">
              <RiskPanel risk={account.risk} balanceUsd={account.balanceUsd} />
              <FillTape fills={fills} />
            </aside>
          </div>
        </>
      )}
    </main>
  );
}

function LoadingState() {
  return (
    <main className="mx-auto max-w-7xl animate-pulse space-y-4 px-4 py-5 sm:px-6" aria-busy="true" aria-label="Loading snapshot">
      <div className="h-14 rounded-lg bg-ink-900" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className={`h-24 rounded-lg bg-ink-900 ${i === 0 ? 'sm:col-span-2' : ''}`} />
        ))}
      </div>
      <div className="h-64 rounded-lg bg-ink-900" />
    </main>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <main className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center gap-4 px-4 text-center">
      <div className="text-3xl text-down">⚠</div>
      <h1 className="text-lg font-semibold">Snapshot unavailable</h1>
      <p className="text-sm text-ink-300">{message}</p>
      <button onClick={onRetry} className="rounded-md bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-500">
        Retry
      </button>
    </main>
  );
}

function EmptyState() {
  return (
    <div className="rounded-lg border border-dashed border-ink-700 bg-ink-900 px-6 py-16 text-center">
      <h2 className="font-semibold">No trading accounts</h2>
      <p className="mt-1 text-sm text-ink-400">There are no accounts linked to your profile yet.</p>
    </div>
  );
}
