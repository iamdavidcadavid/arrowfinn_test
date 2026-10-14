import { CanActivate, createParamDecorator, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { TenantContext } from '../../domain/model';
import { SESSION_COOKIE, TokenService } from './token.service';

type AuthedRequest = Request & { tenant?: TenantContext };

/** Authenticates the request from the httpOnly session cookie and attaches the tenant context. */
@Injectable()
export class SessionGuard implements CanActivate {
  constructor(private readonly tokens: TokenService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<AuthedRequest>();
    const session = this.tokens.verify(req.cookies?.[SESSION_COOKIE]);
    if (!session) throw new UnauthorizedException();
    req.tenant = { brokerId: session.brokerId, traderId: session.traderId };
    return true;
  }
}

/**
 * The tenant for this request. Controllers take tenant + trader from here and
 * nowhere else: no route accepts a broker id or trader id as a parameter.
 */
export const CurrentTenant = createParamDecorator((_: unknown, context: ExecutionContext): TenantContext => {
  const tenant = context.switchToHttp().getRequest<AuthedRequest>().tenant;
  if (!tenant) throw new UnauthorizedException(); // guard missing on the route: fail closed
  return tenant;
});
