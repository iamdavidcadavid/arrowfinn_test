import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { computeAccountSnapshot } from '../domain/snapshot-calculator';
import { tradingSessionFor } from '../domain/session';
import { AccountSnapshot, TenantContext, TraderSnapshot } from '../domain/model';
import { CLOCK, Clock, SNAPSHOT_READ_PORT, SnapshotReadPort, TraderBook } from './ports';

@Injectable()
export class GetSnapshotUseCase {
  constructor(
    @Inject(SNAPSHOT_READ_PORT) private readonly reader: SnapshotReadPort,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async execute(ctx: TenantContext): Promise<TraderSnapshot> {
    const now = this.clock.now();
    const session = tradingSessionFor(now);
    const book = await this.reader.loadTraderBook(ctx, now);
    // Same response whether the trader is missing or belongs to another tenant:
    // never reveal that an id exists elsewhere.
    if (!book) throw new NotFoundException();

    const accounts = book.accounts.map((a) => this.accountSnapshot(book, a.id, session));
    const seqs = accounts.map((a) => a.lastFillSeq).filter((s): s is string => s !== null).map(BigInt);
    const lastFillSeq = seqs.length ? seqs.reduce((m, s) => (s > m ? s : m)).toString() : null;

    return {
      asOf: now.toISOString(),
      session: { start: session.start.toISOString(), end: session.end.toISOString() },
      trader: {
        id: book.trader.id,
        // First name + last initial is all the widget needs to greet the user.
        displayName: `${book.trader.firstName} ${book.trader.lastName.charAt(0)}.`,
        brokerName: book.trader.brokerName,
        brokerType: book.trader.brokerType,
      },
      accounts,
      lastFillSeq,
    };
  }

  async executeForAccount(ctx: TenantContext, accountId: string): Promise<AccountSnapshot | null> {
    const now = this.clock.now();
    const book = await this.reader.loadTraderBook(ctx, now);
    if (!book || !book.accounts.some((a) => a.id === accountId)) return null;
    return this.accountSnapshot(book, accountId, tradingSessionFor(now));
  }

  private accountSnapshot(book: TraderBook, accountId: string, session: ReturnType<typeof tradingSessionFor>) {
    const account = book.accounts.find((a) => a.id === accountId)!;
    return computeAccountSnapshot({
      account,
      fills: book.fills.filter((f) => f.accountId === accountId),
      instruments: book.instruments,
      marks: book.marks,
      session,
    });
  }
}
