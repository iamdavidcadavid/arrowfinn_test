/**
 * Loads dataset/*.csv into Postgres. Runs as the schema OWNER (not the app role)
 * because it writes across all tenants. Idempotent: skips if already seeded.
 *
 * PII minimisation happens here: of the 16 columns in traders.csv only id,
 * broker_id, first/last name, email and kyc_status are stored. DOB, ssn_last4,
 * phone, address, notes and audit_notes are read from the file and dropped.
 */
import { PrismaClient } from '@prisma/client';
import { parse } from 'csv-parse/sync';
import bcrypt from 'bcryptjs';
import fs from 'node:fs';
import path from 'node:path';

const DATASET_DIR = process.env.DATASET_DIR ?? path.resolve(__dirname, '../../dataset');
const DEMO_PASSWORD = process.env.DEMO_PASSWORD ?? 'demo-password';

type Row = Record<string, string>;
const read = (file: string): Row[] =>
  parse(fs.readFileSync(path.join(DATASET_DIR, file)), { columns: true, skip_empty_lines: true, trim: true });

async function main() {
  const prisma = new PrismaClient();
  try {
    if ((await prisma.broker.count()) > 0) {
      console.log('seed: already seeded, skipping');
      return;
    }
    const brokers = read('brokers.csv');
    const traders = read('traders.csv');
    const accounts = read('accounts.csv');
    const instruments = read('instruments.csv');
    const prices = read('market_prices.csv');
    const fills = read('fills.csv');

    const traderBroker = new Map(traders.map((t) => [t.id, t.broker_id]));
    const accountBroker = new Map(accounts.map((a) => [a.id, traderBroker.get(a.trader_id)!]));
    // One hash shared by all demo users; cost 10 keeps container start fast.
    const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

    await prisma.$transaction(async (tx) => {
      await tx.broker.createMany({
        data: brokers.map((b) => ({
          id: b.id, name: b.name, type: b.type as 'retail' | 'prop', whiteLabelName: b.white_label_name, createdAt: new Date(b.created_at),
        })),
      });
      await tx.trader.createMany({
        data: traders.map((t) => ({
          id: t.id, brokerId: t.broker_id, firstName: t.first_name, lastName: t.last_name, email: t.email.toLowerCase(),
          kycStatus: t.kyc_status, passwordHash, createdAt: new Date(t.created_at),
        })),
      });
      await tx.account.createMany({
        data: accounts.map((a) => ({
          id: a.id, brokerId: accountBroker.get(a.id)!, traderId: a.trader_id, accountNumber: a.account_number,
          accountType: a.account_type, balance: a.balance, buyingPower: a.buying_power,
          maxPositionSize: Number(a.max_position_size), status: a.status, createdAt: new Date(a.created_at),
        })),
      });
      await tx.instrument.createMany({
        data: instruments.map((i) => ({
          symbol: i.symbol, description: i.description, exchange: i.exchange, pointValueUsd: i.point_value_usd,
          tickSize: i.tick_size, tickValueUsd: i.tick_value_usd, initialMarginUsd: i.initial_margin_usd,
          maintenanceMarginUsd: i.maintenance_margin_usd,
        })),
      });
      await tx.marketPrice.createMany({
        data: prices.map((p) => ({ symbol: p.symbol, markPrice: p.mark_price, asOf: new Date(p.as_of) })),
      });
      // Insert in time order so seq follows filled_at for the historical data.
      const ordered = [...fills].sort((a, b) => a.filled_at.localeCompare(b.filled_at) || a.id.localeCompare(b.id));
      await tx.fill.createMany({
        data: ordered.map((f) => ({
          id: f.id, brokerId: accountBroker.get(f.account_id)!, accountId: f.account_id, instrumentSymbol: f.instrument_symbol,
          side: f.side as 'BUY' | 'SELL', quantity: Number(f.quantity), price: f.price, filledAt: new Date(f.filled_at),
          orderId: f.order_id, liquidity: f.liquidity, commissionUsd: f.commission_usd,
        })),
      });
    });
    console.log(`seed: ${brokers.length} brokers, ${traders.length} traders, ${accounts.length} accounts, ${fills.length} fills`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error('seed failed:', e.message);
  process.exit(1);
});
