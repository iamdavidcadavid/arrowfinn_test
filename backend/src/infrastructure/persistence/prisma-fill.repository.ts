import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import Decimal from 'decimal.js';
import { FillWritePort, NewFill } from '../../application/ports';
import { PrismaService } from './prisma.service';

@Injectable()
export class PrismaFillRepository implements FillWritePort {
  constructor(private readonly prisma: PrismaService) {}

  async findAccountTenant(accountId: string): Promise<string | null> {
    // SECURITY DEFINER function: the only cross-tenant read the app role has.
    const rows = await this.prisma.$queryRaw<{ broker_id: string }[]>`SELECT broker_id FROM dev_account_tenant(${accountId})`;
    return rows[0]?.broker_id ?? null;
  }

  insertFill(brokerId: string, f: NewFill) {
    return this.prisma.withTenant(brokerId, async (tx) => {
      const account = await tx.account.findFirst({ where: { id: f.accountId, brokerId }, select: { traderId: true } });
      if (!account) throw new Error('account not visible in tenant');
      const row = await tx.fill.create({
        data: {
          id: `FIL-SIM-${randomUUID()}`,
          brokerId,
          accountId: f.accountId,
          instrumentSymbol: f.symbol,
          side: f.side,
          quantity: f.quantity,
          price: f.price.toString(),
          commissionUsd: f.commissionUsd.toString(),
          filledAt: f.filledAt,
          orderId: `ORD-SIM-${randomUUID()}`,
          liquidity: 'taker',
        },
      });
      return {
        traderId: account.traderId,
        fill: {
          seq: row.seq,
          accountId: row.accountId,
          symbol: row.instrumentSymbol,
          side: row.side,
          quantity: row.quantity,
          price: new Decimal(row.price.toString()),
          filledAt: row.filledAt,
          commissionUsd: new Decimal(row.commissionUsd.toString()),
        },
      };
    });
  }
}
