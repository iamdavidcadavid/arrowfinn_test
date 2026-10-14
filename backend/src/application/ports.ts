import Decimal from 'decimal.js';
import { AccountRecord, AccountSnapshot, FillRecord, InstrumentSpec, Side, TenantContext } from '../domain/model';

// Hexagonal ports. The application layer depends on these interfaces only;
// infrastructure/ provides the Prisma, Socket.IO and clock adapters.

export interface TraderBook {
  trader: { id: string; firstName: string; lastName: string; brokerName: string; brokerType: string };
  accounts: AccountRecord[];
  /** All fills for those accounts with filledAt <= upTo, ordered by (filledAt, seq). */
  fills: FillRecord[];
  instruments: Map<string, InstrumentSpec>;
  marks: Map<string, Decimal>;
}

export const SNAPSHOT_READ_PORT = Symbol('SnapshotReadPort');
export interface SnapshotReadPort {
  /** Returns null when the trader does not exist *inside this tenant*. */
  loadTraderBook(ctx: TenantContext, upTo: Date): Promise<TraderBook | null>;
}

export interface NewFill {
  accountId: string;
  symbol: string;
  side: Side;
  quantity: number;
  price: Decimal;
  commissionUsd: Decimal;
  filledAt: Date;
}

export const FILL_WRITE_PORT = Symbol('FillWritePort');
export interface FillWritePort {
  /** Dev simulator only: which tenant owns this account? */
  findAccountTenant(accountId: string): Promise<string | null>;
  /** Inserts inside the given tenant; returns the owning trader so the event can be routed. */
  insertFill(brokerId: string, fill: NewFill): Promise<{ fill: FillRecord; traderId: string }>;
}

export interface FillEvent {
  seq: string;
  accountId: string;
  symbol: string;
  side: Side;
  quantity: number;
  price: number;
  filledAt: string;
  /** The recomputed account snapshot so the client can update without a refetch. */
  account: AccountSnapshot;
}

export const FILL_EVENT_PUBLISHER = Symbol('FillEventPublisher');
export interface FillEventPublisher {
  /** Delivers only to sockets authenticated as exactly this (broker, trader). */
  publishFill(ctx: TenantContext, event: FillEvent): void;
}

export const CLOCK = Symbol('Clock');
export interface Clock {
  now(): Date;
}
