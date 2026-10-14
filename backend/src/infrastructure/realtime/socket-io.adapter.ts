import { INestApplicationContext } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import type { IncomingMessage } from 'node:http';
import type { ServerOptions } from 'socket.io';

/**
 * Browsers do not apply CORS to WebSocket upgrades and they attach cookies to
 * them, so a cookie-authenticated socket is open to cross-site WebSocket
 * hijacking unless the server checks Origin itself. allowRequest runs for every
 * handshake (polling and websocket) before any auth.
 */
export class OriginCheckedIoAdapter extends IoAdapter {
  constructor(app: INestApplicationContext, private readonly allowedOrigins: string[]) {
    super(app);
  }

  createIOServer(port: number, options?: ServerOptions) {
    return super.createIOServer(port, {
      ...options,
      cors: { origin: this.allowedOrigins, credentials: true },
      allowRequest: (req: IncomingMessage, cb: (err: string | null | undefined, ok: boolean) => void) => cb(null, this.allowedOrigins.includes(req.headers.origin ?? '')),
    });
  }
}
