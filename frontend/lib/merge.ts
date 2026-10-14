import type { AccountSnapshot, FillEvent, TraderSnapshot } from './types';

const seqOf = (s: string | null) => (s === null ? -1n : BigInt(s));

/** Applies a pushed account snapshot only if it is newer than what we hold (events can race a refetch). */
export function applyAccount(snapshot: TraderSnapshot, account: AccountSnapshot): TraderSnapshot {
  const current = snapshot.accounts.find((a) => a.accountId === account.accountId);
  // An event for an account we do not have is ignored, not appended: the server
  // decides which accounts exist for this trader, and the next refetch will show it.
  if (!current || seqOf(account.lastFillSeq) <= seqOf(current.lastFillSeq)) return snapshot;
  const accounts = snapshot.accounts.map((a) => (a.accountId === account.accountId ? account : a));
  const last = accounts.reduce((m, a) => (seqOf(a.lastFillSeq) > m ? seqOf(a.lastFillSeq) : m), -1n);
  return { ...snapshot, accounts, lastFillSeq: last < 0n ? null : last.toString() };
}

export function applyFill(snapshot: TraderSnapshot, event: FillEvent): TraderSnapshot {
  const next = applyAccount(snapshot, event.account);
  return next === snapshot ? snapshot : { ...next, asOf: event.filledAt > next.asOf ? event.filledAt : next.asOf };
}
