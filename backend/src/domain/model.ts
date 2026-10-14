// Pure domain types. No Nest, no Prisma - this layer can be unit tested in isolation.
import Decimal from 'decimal.js';

export type Side = 'BUY' | 'SELL';

/** The only identity the application trusts. Built exclusively from a verified JWT. */
export interface TenantContext {
  readonly brokerId: string;
  readonly traderId: string;
}

export interface InstrumentSpec {
  symbol: string;
  description: string;
  pointValueUsd: Decimal;
}

export interface FillRecord {
  seq: bigint;
  accountId: string;
  symbol: string;
  side: Side;
  quantity: number;
  price: Decimal;
  filledAt: Date;
  commissionUsd: Decimal;
}

export interface AccountRecord {
  id: string;
  accountNumber: string;
  accountType: string;
  status: string;
  balance: Decimal;
}

export interface SessionWindow {
  start: Date;
  end: Date;
}

export type RiskLevel = 'low' | 'elevated' | 'high';

export interface PositionView {
  symbol: string;
  description: string;
  netQty: number;
  avgPrice: number;
  markPrice: number | null;
  pointValueUsd: number;
  notionalUsd: number;
  unrealizedPnlUsd: number;
}

export interface AccountSnapshot {
  accountId: string;
  accountNumber: string;
  accountType: string;
  status: string;
  balanceUsd: number;
  positions: PositionView[];
  pnl: {
    realizedUsd: number;
    unrealizedUsd: number;
    commissionsUsd: number;
    /** realized + unrealized - commissions */
    netUsd: number;
  };
  risk: {
    score: number;
    level: RiskLevel;
    grossNotionalUsd: number;
    /** true when balance <= 0, which pins the score to 100. */
    balanceUnavailable: boolean;
  };
  fillsToday: number;
  /** Highest fill seq that went into this snapshot (string: bigint is not JSON). */
  lastFillSeq: string | null;
}

export interface TraderSnapshot {
  asOf: string;
  session: { start: string; end: string };
  trader: { id: string; displayName: string; brokerName: string; brokerType: string };
  accounts: AccountSnapshot[];
  lastFillSeq: string | null;
}
