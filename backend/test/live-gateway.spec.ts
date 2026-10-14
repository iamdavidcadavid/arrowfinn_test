import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AddressInfo } from 'node:net';
import { io, Socket } from 'socket.io-client';
import { LiveGateway } from '../src/infrastructure/realtime/live.gateway';
import { OriginCheckedIoAdapter } from '../src/infrastructure/realtime/socket-io.adapter';
import { SESSION_COOKIE, TokenService } from '../src/infrastructure/auth/token.service';
import { FillEvent } from '../src/application/ports';

process.env.JWT_SECRET = 'test-secret-test-secret-test-secret-1234';
const ORIGIN = 'http://localhost:3000';

/**
 * Real Socket.IO server + clients: proves a fill published for one tenant is
 * never delivered to a socket authenticated for another, and that the handshake
 * rejects missing tokens and foreign origins.
 */
describe('LiveGateway tenant isolation', () => {
  let app: INestApplication;
  let gateway: LiveGateway;
  let tokens: TokenService;
  let url: string;
  const sockets: Socket[] = [];

  beforeAll(async () => {
    const mod = await Test.createTestingModule({ providers: [LiveGateway, TokenService] }).compile();
    app = mod.createNestApplication();
    app.useWebSocketAdapter(new OriginCheckedIoAdapter(app, [ORIGIN]));
    await app.listen(0);
    url = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}/live`;
    gateway = app.get(LiveGateway);
    tokens = app.get(TokenService);
  });

  afterAll(async () => {
    sockets.forEach((s) => s.close());
    await app.close();
  });

  function connect(opts: { token?: string; origin?: string }): Promise<Socket> {
    const headers: Record<string, string> = { origin: opts.origin ?? ORIGIN };
    if (opts.token) headers.cookie = `${SESSION_COOKIE}=${opts.token}`;
    const s = io(url, { transports: ['websocket'], extraHeaders: headers, reconnection: false });
    sockets.push(s);
    return new Promise((resolve, reject) => {
      s.on('ready', () => resolve(s));
      s.on('connect_error', reject);
    });
  }

  const event = (accountId: string) => ({ seq: '1', accountId, symbol: 'MES', side: 'BUY', quantity: 1, price: 1, filledAt: '', account: {} }) as unknown as FillEvent;

  it('delivers a fill only to the owning trader in the owning tenant', async () => {
    const arwp = await connect({ token: tokens.sign({ brokerId: 'BRK-ARWP', traderId: 'T-001' }) });
    // Same trader id, different tenant: must not receive it.
    const smpt = await connect({ token: tokens.sign({ brokerId: 'BRK-SMPT', traderId: 'T-001' }) });
    const otherTrader = await connect({ token: tokens.sign({ brokerId: 'BRK-ARWP', traderId: 'T-002' }) });

    const got: Record<string, FillEvent[]> = { arwp: [], smpt: [], otherTrader: [] };
    arwp.on('fill', (e) => got.arwp.push(e));
    smpt.on('fill', (e) => got.smpt.push(e));
    otherTrader.on('fill', (e) => got.otherTrader.push(e));
    // A client asking to join another tenant's room is ignored: there is no handler.
    smpt.emit('join', 'tenant:BRK-ARWP:trader:T-001');
    smpt.emit('subscribe', { brokerId: 'BRK-ARWP' });
    await new Promise((r) => setTimeout(r, 100));

    gateway.publishFill({ brokerId: 'BRK-ARWP', traderId: 'T-001' }, event('ACC-1001'));
    await new Promise((r) => setTimeout(r, 200));

    expect(got.arwp).toHaveLength(1);
    expect(got.smpt).toHaveLength(0);
    expect(got.otherTrader).toHaveLength(0);
  });

  it('rejects a handshake without a session', async () => {
    await expect(connect({})).rejects.toThrow('unauthorized');
  });

  it('rejects a tampered token', async () => {
    const t = tokens.sign({ brokerId: 'BRK-ARWP', traderId: 'T-001' });
    const [h, , sig] = t.split('.');
    const forged = Buffer.from(JSON.stringify({ sub: 'T-001', broker_id: 'BRK-SMPT' })).toString('base64url');
    await expect(connect({ token: `${h}.${forged}.${sig}` })).rejects.toThrow('unauthorized');
  });

  it('rejects an alg=none token', async () => {
    const enc = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
    const none = `${enc({ alg: 'none', typ: 'JWT' })}.${enc({ sub: 'T-001', broker_id: 'BRK-SMPT', iss: 'arrowfin-snapshot', aud: 'snapshot-web' })}.`;
    await expect(connect({ token: none })).rejects.toThrow('unauthorized');
  });

  it('rejects a valid session presented from a foreign origin (cross-site WebSocket hijacking)', async () => {
    const token = tokens.sign({ brokerId: 'BRK-ARWP', traderId: 'T-001' });
    await expect(connect({ token, origin: 'https://evil.example' })).rejects.toBeTruthy();
  });
});
