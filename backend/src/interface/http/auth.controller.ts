import { Body, Controller, HttpCode, Post, Res, UnauthorizedException } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';
import { AuthService } from '../../infrastructure/auth/auth.service';
import { SESSION_COOKIE, TokenService } from '../../infrastructure/auth/token.service';

class LoginDto {
  @IsEmail() @MaxLength(254) email!: string;
  @IsString() @MinLength(1) @MaxLength(200) password!: string;
}

const cookieOptions = () => ({
  httpOnly: true, // not readable from JS: an XSS cannot exfiltrate the session
  sameSite: 'strict' as const,
  secure: process.env.COOKIE_SECURE === 'true',
  path: '/',
});

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly tokens: TokenService,
  ) {}

  @Post('login')
  @HttpCode(204)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async login(@Body() body: LoginDto, @Res({ passthrough: true }) res: Response) {
    const token = await this.auth.login(body.email, body.password);
    if (!token) throw new UnauthorizedException('invalid credentials');
    res.cookie(SESSION_COOKIE, token, { ...cookieOptions(), maxAge: this.tokens.ttlSeconds * 1000 });
  }

  @Post('logout')
  @HttpCode(204)
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie(SESSION_COOKIE, cookieOptions());
  }
}
