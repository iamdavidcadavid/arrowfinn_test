import { Logger } from '@nestjs/common';
import { OnGatewayConnection, OnGatewayInit, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { parse as parseCookie } from 'cookie';
import type { Namespace, Socket } from 'socket.io';
import { FillEvent, FillEventPublisher } from '../../application/ports';
import { TenantContext } from '../../domain/model';
import { SESSION_COOKIE, TokenService } from '../auth/token.service';

/** Room key for one trader inside one tenant. Built only from verified claims. */
export function traderRoom(ctx: TenantContext): string {
  return `tenant:${ctx.brokerId}:trader:${ctx.traderId}`;
}

/**
 * Live fill stream.
 *
 * Tenant scoping happens once, at connection time, in the namespace middleware:
 * the socket is rejected unless it carries a valid session cookie, and it is
 * joined to exactly one room derived from that token. There are deliberately NO
 * @SubscribeMessage handlers: a client has no way to ask to join a room, so it
 * has no way to ask to join someone else's.
 */
@WebSocketGateway({ namespace: '/live' })
export class LiveGateway implements OnGatewayInit, OnGatewayConnection, FillEventPublisher {
  private readonly log = new Logger(LiveGateway.name);
  @WebSocketServer() private nsp!: Namespace;

  constructor(private readonly tokens: TokenService) {}

  afterInit(nsp: Namespace) {
    nsp.use((socket, next) => {
      const cookies = parseCookie(socket.handshake.headers.cookie ?? '');
      const session = this.tokens.verify(cookies[SESSION_COOKIE]);
      if (!session) return next(new Error('unauthorized'));
      socket.data.tenant = { brokerId: session.brokerId, traderId: session.traderId } satisfies TenantContext;
      socket.data.expiresAt = session.expiresAt;
      next();
    });
  }

  handleConnection(socket: Socket) {
    const tenant = socket.data.tenant as TenantContext;
    socket.join(traderRoom(tenant));
    // Connection-time auth must not outlive the token.
    const ms = Math.max(0, (socket.data.expiresAt as number) - Date.now());
    const timer = setTimeout(() => socket.disconnect(true), Math.min(ms, 2 ** 31 - 1));
    socket.once('disconnect', () => clearTimeout(timer));
    socket.emit('ready', { serverTime: new Date().toISOString() });
    this.log.log(`socket connected trader=${tenant.traderId} broker=${tenant.brokerId}`);
  }

  publishFill(ctx: TenantContext, event: FillEvent) {
    this.nsp.to(traderRoom(ctx)).emit('fill', event);
  }
}
