import { Injectable } from '@nestjs/common';
import Decimal from 'decimal.js';
import { SnapshotReadPort, TraderBook } from '../../application/ports';
import { TenantContext } from '../../domain/model';
import { PrismaService } from './prisma.service';

@Injectable()
export class PrismaSnapshotRepository implements SnapshotReadPort {
  constructor(private readonly prisma: PrismaService) {}

  loadTraderBook(ctx: TenantContext, upTo: Date): Promise<TraderBook | null> {
    return this.prisma.forContext(ctx, async (tx) => {
      // broker_id is in every WHERE as well as enforced by RLS. Belt and braces:
      // the explicit predicate keeps the index usable and documents intent; RLS
      // catches the day someone deletes it.
      const trader = await tx.trader.findFirst({
        where: { id: ctx.traderId, brokerId: ctx.brokerId },
        select: { id: true, firstName: true, lastName: true, broker: { select: { name: true, whiteLabelName: true, type: true } } },
      });
      if (!trader) return null;

      const accounts = await tx.account.findMany({
        where: { brokerId: ctx.brokerId, traderId: ctx.traderId },
        select: { id: true, accountNumber: true, accountType: true, status: true, balance: true },
        orderBy: { id: 'asc' },
      });
      const accountIds = accounts.map((a) => a.id);

      const [fills, instruments, marks] = await Promise.all([
        accountIds.length
          ? tx.fill.findMany({
              where: { brokerId: ctx.brokerId, accountId: { in: accountIds }, filledAt: { lte: upTo } },
              select: { seq: true, accountId: true, instrumentSymbol: true, side: true, quantity: true, price: true, filledAt: true, commissionUsd: true },
              orderBy: [{ filledAt: 'asc' }, { seq: 'asc' }],
            })
          : Promise.resolve([]),
        tx.instrument.findMany({ select: { symbol: true, description: true, pointValueUsd: true } }),
        tx.marketPrice.findMany({ select: { symbol: true, markPrice: true } }),
      ]);

      return {
        trader: {
          id: trader.id,
          firstName: trader.firstName,
          lastName: trader.lastName,
          brokerName: trader.broker.whiteLabelName,
          brokerType: trader.broker.type,
        },
        accounts: accounts.map((a) => ({ ...a, balance: new Decimal(a.balance.toString()) })),
        fills: fills.map((f) => ({
          seq: f.seq,
          accountId: f.accountId,
          symbol: f.instrumentSymbol,
          side: f.side,
          quantity: f.quantity,
          price: new Decimal(f.price.toString()),
          filledAt: f.filledAt,
          commissionUsd: new Decimal(f.commissionUsd.toString()),
        })),
        instruments: new Map(
          instruments.map((i) => [i.symbol, { symbol: i.symbol, description: i.description, pointValueUsd: new Decimal(i.pointValueUsd.toString()) }]),
        ),
        marks: new Map(marks.map((m) => [m.symbol, new Decimal(m.markPrice.toString())])),
      };
    });
  }
}
