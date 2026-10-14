import { Injectable, Logger } from '@nestjs/common';
import bcrypt from 'bcryptjs';
import { PrismaService } from '../persistence/prisma.service';
import { TokenService } from './token.service';

// Compared against when the email is unknown so both paths cost one bcrypt.
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 10);

@Injectable()
export class AuthService {
  private readonly log = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokenService,
  ) {}

  async login(email: string, password: string): Promise<string | null> {
    const rows = await this.prisma.$queryRaw<
      { trader_id: string; broker_id: string; password_hash: string; kyc_status: string }[]
    >`SELECT trader_id, broker_id, password_hash, kyc_status FROM auth_find_trader(${email})`;
    const row = rows[0];
    const ok = await bcrypt.compare(password, row?.password_hash ?? DUMMY_HASH);
    if (!row || !ok) {
      // Never log the submitted email or password.
      this.log.warn('login rejected: bad credentials');
      return null;
    }
    if (row.kyc_status === 'suspended') {
      this.log.warn(`login rejected: suspended trader=${row.trader_id}`);
      return null;
    }
    this.log.log(`login ok trader=${row.trader_id} broker=${row.broker_id}`);
    return this.tokens.sign({ brokerId: row.broker_id, traderId: row.trader_id });
  }
}
