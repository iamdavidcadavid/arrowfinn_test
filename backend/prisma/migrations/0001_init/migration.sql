-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "BrokerType" AS ENUM ('retail', 'prop');

-- CreateEnum
CREATE TYPE "Side" AS ENUM ('BUY', 'SELL');

-- CreateTable
CREATE TABLE "brokers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "BrokerType" NOT NULL,
    "white_label_name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "brokers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "traders" (
    "id" TEXT NOT NULL,
    "broker_id" TEXT NOT NULL,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "kyc_status" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "traders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounts" (
    "id" TEXT NOT NULL,
    "broker_id" TEXT NOT NULL,
    "trader_id" TEXT NOT NULL,
    "account_number" TEXT NOT NULL,
    "account_type" TEXT NOT NULL,
    "balance" DECIMAL(18,2) NOT NULL,
    "buying_power" DECIMAL(18,2) NOT NULL,
    "max_position_size" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "instruments" (
    "symbol" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "exchange" TEXT NOT NULL,
    "point_value_usd" DECIMAL(18,6) NOT NULL,
    "tick_size" DECIMAL(18,6) NOT NULL,
    "tick_value_usd" DECIMAL(18,2) NOT NULL,
    "initial_margin_usd" DECIMAL(18,2) NOT NULL,
    "maintenance_margin_usd" DECIMAL(18,2) NOT NULL,

    CONSTRAINT "instruments_pkey" PRIMARY KEY ("symbol")
);

-- CreateTable
CREATE TABLE "market_prices" (
    "symbol" TEXT NOT NULL,
    "mark_price" DECIMAL(18,6) NOT NULL,
    "as_of" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "market_prices_pkey" PRIMARY KEY ("symbol")
);

-- CreateTable
CREATE TABLE "fills" (
    "id" TEXT NOT NULL,
    "seq" BIGSERIAL NOT NULL,
    "broker_id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "instrument_symbol" TEXT NOT NULL,
    "side" "Side" NOT NULL,
    "quantity" INTEGER NOT NULL,
    "price" DECIMAL(18,6) NOT NULL,
    "filled_at" TIMESTAMP(3) NOT NULL,
    "order_id" TEXT NOT NULL,
    "liquidity" TEXT NOT NULL,
    "commission_usd" DECIMAL(18,2) NOT NULL,

    CONSTRAINT "fills_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "traders_email_key" ON "traders"("email");

-- CreateIndex
CREATE UNIQUE INDEX "traders_id_broker_id_key" ON "traders"("id", "broker_id");

-- CreateIndex
CREATE INDEX "accounts_broker_id_trader_id_idx" ON "accounts"("broker_id", "trader_id");

-- CreateIndex
CREATE UNIQUE INDEX "accounts_id_broker_id_key" ON "accounts"("id", "broker_id");

-- CreateIndex
CREATE UNIQUE INDEX "fills_seq_key" ON "fills"("seq");

-- CreateIndex
CREATE INDEX "fills_broker_id_account_id_filled_at_idx" ON "fills"("broker_id", "account_id", "filled_at");

-- AddForeignKey
ALTER TABLE "traders" ADD CONSTRAINT "traders_broker_id_fkey" FOREIGN KEY ("broker_id") REFERENCES "brokers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_trader_id_broker_id_fkey" FOREIGN KEY ("trader_id", "broker_id") REFERENCES "traders"("id", "broker_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "market_prices" ADD CONSTRAINT "market_prices_symbol_fkey" FOREIGN KEY ("symbol") REFERENCES "instruments"("symbol") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fills" ADD CONSTRAINT "fills_account_id_broker_id_fkey" FOREIGN KEY ("account_id", "broker_id") REFERENCES "accounts"("id", "broker_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fills" ADD CONSTRAINT "fills_instrument_symbol_fkey" FOREIGN KEY ("instrument_symbol") REFERENCES "instruments"("symbol") ON DELETE RESTRICT ON UPDATE CASCADE;

