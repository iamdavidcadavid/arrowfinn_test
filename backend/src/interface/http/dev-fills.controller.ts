import { Body, Controller, Post } from '@nestjs/common';
import { IsIn, IsInt, IsNumber, IsPositive, Matches, Max, Min } from 'class-validator';
import Decimal from 'decimal.js';
import { RecordFillUseCase } from '../../application/record-fill.use-case';

class DevFillDto {
  // Strict formats keep attacker-controlled strings out of logs and SQL params alike.
  @Matches(/^ACC-\d{4}$/) account_id!: string;
  @Matches(/^[A-Z0-9]{1,6}$/) instrument_symbol!: string;
  @IsIn(['BUY', 'SELL']) side!: 'BUY' | 'SELL';
  @IsInt() @Min(1) @Max(1000) quantity!: number;
  @IsNumber() @IsPositive() price!: number;
  @IsNumber() @Min(0) commission_usd!: number;
}

/**
 * DEVELOPMENT ONLY. Only registered when DevModule is imported, which
 * AppModule does only if ENABLE_DEV_ENDPOINTS=true, and main.ts refuses to boot
 * when that flag is combined with NODE_ENV=production.
 */
@Controller('dev')
export class DevFillsController {
  constructor(private readonly recordFill: RecordFillUseCase) {}

  @Post('fills')
  create(@Body() body: DevFillDto) {
    return this.recordFill.execute({
      accountId: body.account_id,
      symbol: body.instrument_symbol,
      side: body.side,
      quantity: body.quantity,
      price: new Decimal(body.price),
      commissionUsd: new Decimal(body.commission_usd),
    });
  }
}
