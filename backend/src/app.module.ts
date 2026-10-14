import { DynamicModule, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { SnapshotModule } from './snapshot.module';
import { DevModule } from './dev.module';

export function devEndpointsEnabled(): boolean {
  return process.env.ENABLE_DEV_ENDPOINTS === 'true' && process.env.NODE_ENV !== 'production';
}

@Module({})
export class AppModule {
  static register(): DynamicModule {
    return {
      module: AppModule,
      imports: [
        ThrottlerModule.forRoot([{ ttl: 60_000, limit: 300 }]),
        SnapshotModule,
        // The dev simulator is not "disabled" in production, it is absent:
        // its controller is never registered, so there is no route to reach.
        ...(devEndpointsEnabled() ? [DevModule] : []),
      ],
      providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
    };
  }
}
