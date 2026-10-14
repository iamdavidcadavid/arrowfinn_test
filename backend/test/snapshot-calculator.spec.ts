import Decimal from 'decimal.js';
import { computeAccountSnapshot } from '../src/domain/snapshot-calculator';
import { FillRecord, InstrumentSpec } from '../src/domain/model';

const D = (n: number | string) => new Decimal(n);
const instruments = new Map<string, InstrumentSpec>([
  ['ES', { symbol: 'ES', description: 'E-mini S&P 500', pointValueUsd: D(50) }],
  ['MES', { symbol: 'MES', description: 'Micro E-mini S&P 500', pointValueUsd: D(5) }],
  ['CL', { symbol: 'CL', description: 'Crude Oil', pointValueUsd: D(1000) }],
]);
const marks = new Map([['ES', D(5642.25)], ['MES', D(5642.25)], ['CL', D(74.18)]]);
const session = { start: new Date('2026-08-24T22:00:00Z'), end: new Date('2026-08-25T21:00:00Z') };
const account = { id: 'ACC-1', accountNumber: 'X-1', accountType: 'funded', status: 'active', balance: D(50_000) };

let seq = 0n;
function fill(symbol: string, side: 'BUY' | 'SELL', quantity: number, price: number, at = '2026-08-25T10:00:00Z', commission = 0): FillRecord {
  seq += 1n;
  return { seq, accountId: 'ACC-1', symbol, side, quantity, price: D(price), filledAt: new Date(at), commissionUsd: D(commission) };
}
const run = (fills: FillRecord[], balance = 50_000) =>
  computeAccountSnapshot({ account: { ...account, balance: D(balance) }, fills, instruments, marks, session });

describe('computeAccountSnapshot', () => {
  it('values an open position with the instrument point value (ES is 10x MES)', () => {
    const es = run([fill('ES', 'BUY', 1, 5640)]);
    const mes = run([fill('MES', 'BUY', 1, 5640)]);
    expect(es.positions[0]).toMatchObject({ symbol: 'ES', netQty: 1, avgPrice: 5640, markPrice: 5642.25 });
    expect(es.pnl.unrealizedUsd).toBe(112.5); // 2.25 pts * $50
    expect(mes.pnl.unrealizedUsd).toBe(11.25); // 2.25 pts * $5
    expect(es.risk.grossNotionalUsd).toBe(282_112.5);
  });

  it('realizes P&L on a round trip and nets commissions', () => {
    const s = run([fill('CL', 'BUY', 2, 73.5, undefined, 4.2), fill('CL', 'SELL', 2, 73.75, undefined, 4.2)]);
    expect(s.positions).toHaveLength(0);
    expect(s.pnl.realizedUsd).toBe(500); // 0.25 * 2 * 1000
    expect(s.pnl.commissionsUsd).toBe(8.4);
    expect(s.pnl.netUsd).toBe(491.6);
    expect(s.risk.score).toBe(0);
  });

  it('averages partial fills of one order and realizes against the average', () => {
    const s = run([fill('MES', 'SELL', 1, 5650), fill('MES', 'SELL', 1, 5652), fill('MES', 'BUY', 1, 5645)]);
    expect(s.positions[0]).toMatchObject({ netQty: -1, avgPrice: 5651 });
    expect(s.pnl.realizedUsd).toBe(30); // (5651 - 5645) * 1 * 5
    expect(s.pnl.unrealizedUsd).toBe(43.75); // (5651 - 5642.25) * 1 * 5, short
  });

  it('handles a flip through zero: closes the old side, opens the new side at the fill price', () => {
    const s = run([fill('MES', 'BUY', 2, 5640), fill('MES', 'SELL', 5, 5644)]);
    expect(s.pnl.realizedUsd).toBe(40); // 4 pts * 2 * 5
    expect(s.positions[0]).toMatchObject({ netQty: -3, avgPrice: 5644 });
  });

  it('only counts realized P&L and commissions from fills inside today\'s session', () => {
    const s = run([
      fill('MES', 'BUY', 1, 5600, '2026-08-24T15:00:00Z', 0.7), // previous session
      fill('MES', 'SELL', 1, 5610, '2026-08-24T19:00:00Z', 0.7), // previous session
      fill('MES', 'BUY', 1, 5640, '2026-08-24T22:00:00Z', 0.7), // first second of today's session
    ]);
    expect(s.pnl.realizedUsd).toBe(0);
    expect(s.pnl.commissionsUsd).toBe(0.7);
    expect(s.fillsToday).toBe(1);
    expect(s.positions[0].netQty).toBe(1);
  });

  it('keeps a position carried in from a previous session', () => {
    const s = run([fill('MES', 'BUY', 2, 5630, '2026-08-21T15:00:00Z')]);
    expect(s.positions[0].netQty).toBe(2);
    expect(s.fillsToday).toBe(0);
  });

  it('computes risk = min(100, |gross notional| / balance * 100) with high level above 75', () => {
    // 1 MES @ 5642.25 * 5 = 28,211.25 notional
    expect(run([fill('MES', 'BUY', 1, 5640)], 50_000).risk).toMatchObject({ score: 56.4, level: 'elevated' });
    expect(run([fill('MES', 'BUY', 1, 5640)], 30_000).risk).toMatchObject({ score: 94, level: 'high' });
    expect(run([fill('ES', 'BUY', 1, 5640)], 50_000).risk.score).toBe(100); // capped
  });

  it('uses gross, not net, notional so offsetting positions do not hide risk', () => {
    const s = run([fill('ES', 'BUY', 1, 5640), fill('MES', 'SELL', 10, 5640)], 1_000_000);
    expect(s.risk.grossNotionalUsd).toBe(564_225);
    expect(s.risk.score).toBe(56.4);
  });

  it('pins risk to 100 when the balance is zero and a position is open, without dividing by zero', () => {
    const s = run([fill('MES', 'BUY', 1, 5640)], 0);
    expect(s.risk).toMatchObject({ score: 100, level: 'high', balanceUnavailable: true });
    expect(run([], 0).risk.score).toBe(0);
  });

  it('returns an empty snapshot for an account with no fills', () => {
    const s = run([]);
    expect(s).toMatchObject({ positions: [], fillsToday: 0, lastFillSeq: null });
    expect(s.pnl.netUsd).toBe(0);
  });

  it('refuses to fold a fill from another account', () => {
    const foreign = { ...fill('MES', 'BUY', 1, 5640), accountId: 'ACC-OTHER' };
    expect(() => run([foreign])).toThrow('fill does not belong to account');
  });
});
