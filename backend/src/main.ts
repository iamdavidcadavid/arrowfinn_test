import 'reflect-metadata';
import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import { AppModule, devEndpointsEnabled } from './app.module';
import { OriginCheckedIoAdapter } from './infrastructure/realtime/socket-io.adapter';

async function bootstrap() {
  if (process.env.NODE_ENV === 'production' && process.env.ENABLE_DEV_ENDPOINTS === 'true') {
    throw new Error('ENABLE_DEV_ENDPOINTS must not be set in production');
  }
  const origins = (process.env.ALLOWED_ORIGINS ?? 'http://localhost:3000').split(',').map((o) => o.trim());

  const app = await NestFactory.create(AppModule.register(), { logger: ['log', 'warn', 'error'] });
  app.use(cookieParser());
  app.enableCors({ origin: origins, credentials: true });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  app.useWebSocketAdapter(new OriginCheckedIoAdapter(app, origins));
  app.enableShutdownHooks();

  const port = Number(process.env.PORT ?? 4000);
  await app.listen(port, '0.0.0.0');
  Logger.log(`backend listening on :${port} (dev endpoints ${devEndpointsEnabled() ? 'ON' : 'off'})`, 'Bootstrap');
}

bootstrap();
