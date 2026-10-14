import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';
import { TenantContext } from '../../domain/model';

export type TenantTx = Prisma.TransactionClient;

/**
 * The single gateway to the database for tenant data.
 *
 * Repositories never receive the raw client for tenant tables; they receive a
 * transaction in which `app.broker_id` has already been set from the verified
 * JWT. Postgres RLS (prisma/migrations/0002_tenant_rls) then filters every
 * statement in that transaction to the tenant, whatever WHERE clause the code wrote.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  withTenant<T>(brokerId: string, fn: (tx: TenantTx) => Promise<T>): Promise<T> {
    if (!brokerId) throw new Error('withTenant called without a broker id');
    return this.$transaction(async (tx) => {
      // is_local = true: the setting dies with the transaction, so a pooled
      // connection can never carry one request's tenant into the next request.
      await tx.$executeRaw`SELECT set_config('app.broker_id', ${brokerId}, true)`;
      return fn(tx);
    });
  }

  forContext<T>(ctx: TenantContext, fn: (tx: TenantTx) => Promise<T>): Promise<T> {
    return this.withTenant(ctx.brokerId, fn);
  }
}
