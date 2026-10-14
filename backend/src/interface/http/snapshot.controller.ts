import { Controller, Get, Header, UseGuards } from '@nestjs/common';
import { GetSnapshotUseCase } from '../../application/get-snapshot.use-case';
import { TenantContext, TraderSnapshot } from '../../domain/model';
import { CurrentTenant, SessionGuard } from '../../infrastructure/auth/session.guard';

@Controller('api/snapshot')
@UseGuards(SessionGuard)
export class SnapshotController {
  constructor(private readonly getSnapshot: GetSnapshotUseCase) {}

  /**
   * GET /api/snapshot - today's snapshot for the authenticated trader.
   * There is intentionally no :traderId or :accountId in the path; identity and
   * tenant come only from the verified session, so there is nothing to tamper with.
   */
  @Get()
  @Header('Cache-Control', 'no-store')
  snapshot(@CurrentTenant() tenant: TenantContext): Promise<TraderSnapshot> {
    return this.getSnapshot.execute(tenant);
  }
}
