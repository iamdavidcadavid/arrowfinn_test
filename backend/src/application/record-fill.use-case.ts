import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { CLOCK, Clock, FILL_EVENT_PUBLISHER, FILL_WRITE_PORT, FillEventPublisher, FillWritePort, NewFill } from './ports';
import { GetSnapshotUseCase } from './get-snapshot.use-case';

/** Persists a fill and pushes it to the owning trader's live stream. */
@Injectable()
export class RecordFillUseCase {
  private readonly log = new Logger(RecordFillUseCase.name);

  constructor(
    @Inject(FILL_WRITE_PORT) private readonly writer: FillWritePort,
    @Inject(FILL_EVENT_PUBLISHER) private readonly publisher: FillEventPublisher,
    @Inject(CLOCK) private readonly clock: Clock,
    private readonly snapshots: GetSnapshotUseCase,
  ) {}

  async execute(input: Omit<NewFill, 'filledAt'>) {
    // Tenant comes from the account row in the database, never from the request body.
    const brokerId = await this.writer.findAccountTenant(input.accountId);
    if (!brokerId) throw new NotFoundException('unknown account');

    const { fill, traderId } = await this.writer.insertFill(brokerId, { ...input, filledAt: this.clock.now() });
    const ctx = { brokerId, traderId };
    const account = await this.snapshots.executeForAccount(ctx, fill.accountId);
    if (!account) throw new Error('account vanished after insert');

    this.publisher.publishFill(ctx, {
      seq: fill.seq.toString(),
      accountId: fill.accountId,
      symbol: fill.symbol,
      side: fill.side,
      quantity: fill.quantity,
      price: fill.price.toNumber(),
      filledAt: fill.filledAt.toISOString(),
      account,
    });
    // Ids only: no names, no balances in logs.
    this.log.log(`fill seq=${fill.seq} account=${fill.accountId} broker=${brokerId}`);
    return { seq: fill.seq.toString(), accountId: fill.accountId, filledAt: fill.filledAt.toISOString() };
  }
}
