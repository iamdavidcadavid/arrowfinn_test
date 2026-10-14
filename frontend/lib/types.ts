// Mirrors backend/src/domain/model.ts (response contract of GET /api/snapshot).
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
  pnl: { realizedUsd: number; unrealizedUsd: number; commissionsUsd: number; netUsd: number };
  risk: { score: number; level: RiskLevel; grossNotionalUsd: number; balanceUnavailable: boolean };
  fillsToday: number;
  lastFillSeq: string | null;
}

export interface TraderSnapshot {
  asOf: string;
  session: { start: string; end: string };
  trader: { id: string; displayName: string; brokerName: string; brokerType: string };
  accounts: AccountSnapshot[];
  lastFillSeq: string | null;
}

export interface FillEvent {
  seq: string;
  accountId: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  quantity: number;
  price: number;
  filledAt: string;
  account: AccountSnapshot;
}
