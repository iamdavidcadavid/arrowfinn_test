import { NotFoundException } from '@nestjs/common';
import Decimal from 'decimal.js';
import { GetSnapshotUseCase } from '../src/application/get-snapshot.use-case';
import { SnapshotReadPort, TraderBook } from '../src/application/ports';
import { TenantContext } from '../src/domain/model';

/** In-memory adapter that behaves like the RLS-backed repository: rows are keyed by tenant. */
class FakeReader implements SnapshotReadPort {
  calls: TenantContext[] = [];
  constructor(private readonly books: Record<string, TraderBook>) {}
  async loadTraderBook(ctx: TenantContext) {
    this.calls.push(ctx);
    return this.books[`${ctx.brokerId}/${ctx.traderId}`] ?? null;
  }
}

const book: TraderBook = {
  trader: { id: 'T-001', firstName: 'Sarah', lastName: 'Chen', brokerName: 'EdgeClear X', brokerType: 'retail' },
  accounts: [{ id: 'ACC-1001', accountNumber: 'APX-100001', accountType: 'funded', status: 'active', balance: new Decimal(50_000) }],
  fills: [
    { seq: 7n, accountId: 'ACC-1001', symbol: 'MES', side: 'BUY', quantity: 1, price: new Decimal(5640), filledAt: new Date('2026-08-25T10:00:00Z'), commissionUsd: new Decimal(0.7) },
  ],
  instruments: new Map([['MES', { symbol: 'MES', description: 'Micro E-mini S&P 500', pointValueUsd: new Decimal(5) }]]),
  marks: new Map([['MES', new Decimal(5642.25)]]),
};
const clock = { now: () => new Date('2026-08-25T14:30:00Z') };

describe('GetSnapshotUseCase', () => {
  const reader = new FakeReader({ 'BRK-ARWP/T-001': book });
  const useCase = new GetSnapshotUseCase(reader, clock);

  it('returns the snapshot for the authenticated trader in their tenant', async () => {
    const s = await useCase.execute({ brokerId: 'BRK-ARWP', traderId: 'T-001' });
    expect(s.session.start).toBe('2026-08-24T22:00:00.000Z');
    expect(s.accounts[0].risk.score).toBe(56.4);
    expect(s.lastFillSeq).toBe('7');
    expect(s.trader.displayName).toBe('Sarah C.');
  });

  it('fails cross-tenant: the same trader id under a different broker is not found', async () => {
    await expect(useCase.execute({ brokerId: 'BRK-SMPT', traderId: 'T-001' })).rejects.toBeInstanceOf(NotFoundException);
  });

  it('passes the tenant from the session straight to the repository', async () => {
    reader.calls = [];
    await useCase.execute({ brokerId: 'BRK-ARWP', traderId: 'T-001' });
    expect(reader.calls).toEqual([{ brokerId: 'BRK-ARWP', traderId: 'T-001' }]);
  });

  it('exposes no PII beyond a display name', async () => {
    const s = await useCase.execute({ brokerId: 'BRK-ARWP', traderId: 'T-001' });
    expect(Object.keys(s.trader).sort()).toEqual(['brokerName', 'brokerType', 'displayName', 'id']);
    expect(JSON.stringify(s)).not.toMatch(/Chen|@/);
  });
});
