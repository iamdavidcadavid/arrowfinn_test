import { PrismaClient } from '@prisma/client';
import Decimal from 'decimal.js';
import { PrismaService } from '../src/infrastructure/persistence/prisma.service';
import { PrismaSnapshotRepository } from '../src/infrastructure/persistence/prisma-snapshot.repository';
import { GetSnapshotUseCase } from '../src/application/get-snapshot.use-case';

/**
 * Runs against the real seeded Postgres as the runtime app role, so RLS is in
 * force. Set APP_DATABASE_URL to run (docker compose does, see README); skipped
 * otherwise so `npm test` works without a database.
 */
const url = process.env.APP_DATABASE_URL;
const d = url ? describe : describe.skip;

d('tenant isolation against Postgres RLS', () => {
  const prisma = new PrismaService({ datasources: { db: { url } } } as never);
  const raw = new PrismaClient({ datasources: { db: { url } } });
  const clock = { now: () => new Date('2026-08-25T14:30:00Z') };
  const useCase = new GetSnapshotUseCase(new PrismaSnapshotRepository(prisma), clock);

  afterAll(async () => {
    await prisma.$disconnect();
    await raw.$disconnect();
  });

  it('a query with NO tenant filter at all only sees the current tenant (the forgotten WHERE)', async () => {
    const ids = await prisma.withTenant('BRK-SMPT', (tx) => tx.account.findMany({ select: { id: true, brokerId: true } }));
    expect(ids.length).toBeGreaterThan(0);
    expect(new Set(ids.map((a) => a.brokerId))).toEqual(new Set(['BRK-SMPT']));
    const fills = await prisma.withTenant('BRK-SMPT', (tx) => tx.fill.count({ where: { accountId: 'ACC-1001' } })); // ACC-1001 is BRK-ARWP
    expect(fills).toBe(0);
  });

  it('with no tenant set, the app role sees nothing (fails closed)', async () => {
    expect(await raw.account.count()).toBe(0);
    expect(await raw.fill.count()).toBe(0);
    expect(await raw.trader.count()).toBe(0);
  });

  it('cannot insert a fill into another tenant', async () => {
    await expect(
      prisma.withTenant('BRK-SMPT', (tx) =>
        tx.fill.create({
          data: {
            id: 'FIL-ATTACK', brokerId: 'BRK-ARWP', accountId: 'ACC-1001', instrumentSymbol: 'MES', side: 'BUY',
            quantity: 1, price: '1', filledAt: new Date(), orderId: 'X', liquidity: 'taker', commissionUsd: '0',
          },
        }),
      ),
    ).rejects.toThrow();
  });

  it('a token claiming the wrong tenant for a real trader gets 404, not their data', async () => {
    await expect(useCase.execute({ brokerId: 'BRK-SMPT', traderId: 'T-001' })).rejects.toThrow('Not Found');
  });

  it('computes the seeded snapshot for a high-risk prop trader (T-005, ACC-1006)', async () => {
    const s = await useCase.execute({ brokerId: 'BRK-SMPT', traderId: 'T-005' });
    const acc = s.accounts.find((a) => a.accountId === 'ACC-1006')!;
    expect(acc.positions).toEqual([expect.objectContaining({ symbol: 'MES', netQty: 5 })]);
    expect(acc.risk.score).toBe(94);
    expect(acc.risk.level).toBe('high');
    expect(new Decimal(acc.pnl.netUsd).isFinite()).toBe(true);
  });
});
