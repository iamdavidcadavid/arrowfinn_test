import Decimal from 'decimal.js';
import { RiskLevel } from './model';

export const HIGH_RISK_THRESHOLD = 75;
export const ELEVATED_RISK_THRESHOLD = 50;

/**
 * risk = min(100, abs(positions_notional) / account_balance * 100)
 *
 * positions_notional is the GROSS notional (sum of |qty| * mark * point value per
 * position). Netting long ES against short NQ would let a hedged-looking book
 * report near-zero risk, which is the wrong direction to be wrong in.
 *
 * A balance of zero or less cannot be divided by; any open exposure against it is
 * treated as maximum risk, and a flat book as zero.
 */
export function riskScore(grossNotional: Decimal, balance: Decimal): { score: number; balanceUnavailable: boolean } {
  const notional = grossNotional.abs();
  if (balance.lte(0)) {
    return { score: notional.gt(0) ? 100 : 0, balanceUnavailable: true };
  }
  const raw = notional.div(balance).mul(100);
  return { score: Decimal.min(100, raw).toDecimalPlaces(1).toNumber(), balanceUnavailable: false };
}

export function riskLevel(score: number): RiskLevel {
  if (score > HIGH_RISK_THRESHOLD) return 'high';
  if (score > ELEVATED_RISK_THRESHOLD) return 'elevated';
  return 'low';
}
