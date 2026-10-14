import { Injectable } from '@nestjs/common';
import jwt from 'jsonwebtoken';
import { TenantContext } from '../../domain/model';

export const SESSION_COOKIE = 'snapshot_session';
const ISSUER = 'arrowfin-snapshot';
const AUDIENCE = 'snapshot-web';
const TTL_SECONDS = 8 * 60 * 60;

export interface VerifiedSession extends TenantContext {
  expiresAt: number; // epoch ms
}

@Injectable()
export class TokenService {
  private readonly secret: string;

  constructor() {
    const secret = process.env.JWT_SECRET ?? '';
    if (secret.length < 32) throw new Error('JWT_SECRET must be set and at least 32 characters');
    this.secret = secret;
  }

  readonly ttlSeconds = TTL_SECONDS;

  sign(ctx: TenantContext): string {
    return jwt.sign({ broker_id: ctx.brokerId }, this.secret, {
      algorithm: 'HS256',
      subject: ctx.traderId,
      issuer: ISSUER,
      audience: AUDIENCE,
      expiresIn: TTL_SECONDS,
    });
  }

  /** Returns null for anything that is not a valid, unexpired token we issued. */
  verify(token: string | undefined): VerifiedSession | null {
    if (!token) return null;
    try {
      // algorithms is pinned: a token with alg "none" or RS256 (the classic
      // public-key-as-HMAC-secret confusion) is rejected before the signature is used.
      const claims = jwt.verify(token, this.secret, { algorithms: ['HS256'], issuer: ISSUER, audience: AUDIENCE }) as jwt.JwtPayload;
      const brokerId = claims.broker_id;
      const traderId = claims.sub;
      if (typeof brokerId !== 'string' || !/^BRK-[A-Z0-9]+$/.test(brokerId)) return null;
      if (typeof traderId !== 'string' || !/^T-\d+$/.test(traderId)) return null;
      return { brokerId, traderId, expiresAt: (claims.exp ?? 0) * 1000 };
    } catch {
      return null;
    }
  }
}
