import Decimal from 'decimal.js';
import { AccountRecord, AccountSnapshot, FillRecord, InstrumentSpec, PositionView, SessionWindow } from './model';
import { riskLevel, riskScore } from './risk';

interface PositionState {
  netQty: number; // signed: + long, - short
  avgPrice: Decimal; // weighted-average cost of the open quantity
}

const usd = (d: Decimal) => d.toDecimalPlaces(2).toNumber();

/**
 * Folds an account's fills into open positions and today's P&L.
 *
 * - Positions use weighted-average cost. Adding to a position re-averages;
 *   reducing realizes (exit - avg) * closedQty * point value; crossing through
 *   zero realizes the closed part and opens the remainder at the fill price.
 * - Fills sharing an order_id are partial fills of one order. They are already
 *   individual executions with their own price and quantity, so folding them one
 *   by one gives the same result as folding the aggregated order; no dedupe needed.
 * - "Day" realized P&L and commissions only count fills inside today's session.
 *   Positions are built from the full history up to `now`, so a position carried
 *   in from a prior session still shows. Its unrealized P&L is measured against
 *   its average cost because the dataset has no prior settlement price.
 * - Point value matters: 1 point of ES is $50, of MES $5. Every USD figure
 *   multiplies by the instrument's point_value_usd.
 * - Commission_usd on a fill is already the total for that fill (per contract per
 *   side x quantity); it is subtracted from net P&L.
 *
 * `fills` must be sorted by (filledAt, seq) and must not contain fills after `now`.
 */
export function computeAccountSnapshot(input: {
  account: AccountRecord;
  fills: FillRecord[];
  instruments: Map<string, InstrumentSpec>;
  marks: Map<string, Decimal>;
  session: SessionWindow;
}): AccountSnapshot {
  const { account, fills, instruments, marks, session } = input;
  const positions = new Map<string, PositionState>();
  let realized = new Decimal(0);
  let commissions = new Decimal(0);
  let fillsToday = 0;
  let lastSeq: bigint | null = null;

  for (const f of fills) {
    if (f.accountId !== account.id) {
      // Defence in depth: the repository already scopes by account, but a fill
      // for the wrong account must never be folded into this snapshot.
      throw new Error('fill does not belong to account');
    }
    const spec = instruments.get(f.symbol);
    if (!spec) throw new Error(`unknown instrument ${f.symbol}`);

    const inSession = f.filledAt >= session.start && f.filledAt < session.end;
    if (lastSeq === null || f.seq > lastSeq) lastSeq = f.seq;

    const signed = f.side === 'BUY' ? f.quantity : -f.quantity;
    const pos = positions.get(f.symbol) ?? { netQty: 0, avgPrice: new Decimal(0) };
    const sameDirection = pos.netQty === 0 || Math.sign(pos.netQty) === Math.sign(signed);

    if (sameDirection) {
      const newQty = pos.netQty + signed;
      pos.avgPrice = pos.avgPrice
        .mul(Math.abs(pos.netQty))
        .add(f.price.mul(Math.abs(signed)))
        .div(Math.abs(newQty));
      pos.netQty = newQty;
    } else {
      const closing = Math.min(Math.abs(pos.netQty), Math.abs(signed));
      const direction = Math.sign(pos.netQty); // +1 closing a long, -1 closing a short
      const pnl = f.price.sub(pos.avgPrice).mul(closing).mul(direction).mul(spec.pointValueUsd);
      if (inSession) realized = realized.add(pnl);
      const newQty = pos.netQty + signed;
      if (newQty === 0) pos.avgPrice = new Decimal(0);
      else if (Math.sign(newQty) !== Math.sign(pos.netQty)) pos.avgPrice = f.price; // flipped
      pos.netQty = newQty;
    }
    positions.set(f.symbol, pos);

    if (inSession) {
      commissions = commissions.add(f.commissionUsd);
      fillsToday += 1;
    }
  }

  let unrealized = new Decimal(0);
  let grossNotional = new Decimal(0);
  const views: PositionView[] = [];
  for (const [symbol, pos] of [...positions.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    if (pos.netQty === 0) continue;
    const spec = instruments.get(symbol)!;
    const mark = marks.get(symbol) ?? null;
    // Without a mark we cannot value the position; fall back to cost so the
    // position still counts toward risk, and report the mark as null.
    const priceForValue = mark ?? pos.avgPrice;
    const notional = priceForValue.mul(Math.abs(pos.netQty)).mul(spec.pointValueUsd);
    const upnl = mark ? mark.sub(pos.avgPrice).mul(pos.netQty).mul(spec.pointValueUsd) : new Decimal(0);
    unrealized = unrealized.add(upnl);
    grossNotional = grossNotional.add(notional);
    views.push({
      symbol,
      description: spec.description,
      netQty: pos.netQty,
      avgPrice: pos.avgPrice.toDecimalPlaces(6).toNumber(),
      markPrice: mark ? mark.toNumber() : null,
      pointValueUsd: spec.pointValueUsd.toNumber(),
      notionalUsd: usd(notional),
      unrealizedPnlUsd: usd(upnl),
    });
  }

  const { score, balanceUnavailable } = riskScore(grossNotional, account.balance);
  return {
    accountId: account.id,
    accountNumber: account.accountNumber,
    accountType: account.accountType,
    status: account.status,
    balanceUsd: usd(account.balance),
    positions: views,
    pnl: {
      realizedUsd: usd(realized),
      unrealizedUsd: usd(unrealized),
      commissionsUsd: usd(commissions),
      netUsd: usd(realized.add(unrealized).sub(commissions)),
    },
    risk: { score, level: riskLevel(score), grossNotionalUsd: usd(grossNotional), balanceUnavailable },
    fillsToday,
    lastFillSeq: lastSeq === null ? null : lastSeq.toString(),
  };
}
