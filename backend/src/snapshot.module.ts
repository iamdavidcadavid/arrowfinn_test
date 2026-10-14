import { Module } from '@nestjs/common';
import { GetSnapshotUseCase } from './application/get-snapshot.use-case';
import { RecordFillUseCase } from './application/record-fill.use-case';
import { CLOCK, FILL_EVENT_PUBLISHER, FILL_WRITE_PORT, SNAPSHOT_READ_PORT } from './application/ports';
import { AnchoredClock } from './infrastructure/clock/anchored-clock';
import { PrismaService } from './infrastructure/persistence/prisma.service';
import { PrismaSnapshotRepository } from './infrastructure/persistence/prisma-snapshot.repository';
import { PrismaFillRepository } from './infrastructure/persistence/prisma-fill.repository';
import { LiveGateway } from './infrastructure/realtime/live.gateway';
import { TokenService } from './infrastructure/auth/token.service';
import { AuthService } from './infrastructure/auth/auth.service';
import { SessionGuard } from './infrastructure/auth/session.guard';
import { SnapshotController } from './interface/http/snapshot.controller';
import { AuthController } from './interface/http/auth.controller';
import { HealthController } from './interface/http/health.controller';

/** Wires ports (application/) to adapters (infrastructure/). */
@Module({
  controllers: [SnapshotController, AuthController, HealthController],
  providers: [
    PrismaService,
    TokenService,
    AuthService,
    SessionGuard,
    LiveGateway,
    GetSnapshotUseCase,
    RecordFillUseCase,
    { provide: SNAPSHOT_READ_PORT, useClass: PrismaSnapshotRepository },
    { provide: FILL_WRITE_PORT, useClass: PrismaFillRepository },
    { provide: FILL_EVENT_PUBLISHER, useExisting: LiveGateway },
    {
      provide: CLOCK,
      useFactory: () => {
        const anchor = process.env.SNAPSHOT_NOW;
        return new AnchoredClock(anchor ? new Date(anchor) : null);
      },
    },
  ],
  exports: [RecordFillUseCase],
})
export class SnapshotModule {}
