import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NextFunction, Request, Response } from 'express';
import { AppModule } from './app.module';
import { HttpSanitizingExceptionFilter } from './common/http-exception.filter';

/** Frontend dev origins (must match browser Origin header exactly). */
const STATIC_CORS_ORIGINS = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://172.20.10.3:3000',
  /** IPv6 localhost — some browsers use this instead of 127.0.0.1 */
  'http://[::1]:3000',
] as const;

const CORS_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'] as const;
const CORS_ALLOWED_HEADERS = ['Content-Type', 'Authorization'];

function parseCommaSeparatedOrigins(raw: string | undefined): string[] {
  return (raw ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function collectAllowedOrigins(): string[] {
  const set = new Set<string>(STATIC_CORS_ORIGINS);
  parseCommaSeparatedOrigins(process.env.CORS_ORIGIN).forEach((o) => set.add(o));
  parseCommaSeparatedOrigins(process.env.FRONTEND_URL).forEach((o) => set.add(o));
  return [...set];
}

function isAllowedOrigin(origin: string | undefined, allowed: Set<string>): boolean {
  if (!origin) return false;
  return allowed.has(origin);
}

function applyCorsHeaders(res: Response, origin: string): void {
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader(
    'Access-Control-Allow-Methods',
    CORS_METHODS.join(','),
  );
  res.setHeader(
    'Access-Control-Allow-Headers',
    CORS_ALLOWED_HEADERS.join(','),
  );
  res.setHeader('Vary', 'Origin');
}

const DEV_LOG_PATHS = [
  '/customer/orders',
  '/customer/saved-addresses',
  '/auth/bootstrap-customer',
  '/auth/me',
] as const;

function shouldDevLogRequest(path: string): boolean {
  return DEV_LOG_PATHS.some(
    (p) => path === p || path.startsWith(`${p}/`),
  );
}

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);
  const allowedOrigins = collectAllowedOrigins();
  const allowedSet = new Set(allowedOrigins);
  const isDev = process.env.NODE_ENV !== 'production';

  /**
   * Answer OPTIONS preflight before routing/guards so disallowed routes never 404 without CORS headers.
   */
  app.use((req: Request, res: Response, next: NextFunction) => {
    const path = req.path || req.url?.split('?')[0] || '';
    const origin = typeof req.headers.origin === 'string' ? req.headers.origin : undefined;
    const hasAuthorization = Boolean(req.headers.authorization);

    if (isDev && shouldDevLogRequest(path)) {
      logger.debug(
        JSON.stringify({
          method: req.method,
          path,
          origin: origin ?? null,
          hasAuthorization,
        }),
      );
    }

    if (req.method === 'OPTIONS' && origin && isAllowedOrigin(origin, allowedSet)) {
      applyCorsHeaders(res, origin);
      res.status(204).end();
      return;
    }

    next();
  });

  app.enableCors({
    origin: allowedOrigins,
    methods: [...CORS_METHODS],
    allowedHeaders: [...CORS_ALLOWED_HEADERS],
    credentials: true,
    optionsSuccessStatus: 204,
  });

  logger.log(`CORS allowed origins: ${JSON.stringify(allowedOrigins)}`);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.useGlobalFilters(new HttpSanitizingExceptionFilter());

  const port = Number(process.env.PORT) || 3001;
  await app.listen(port, '0.0.0.0');

  logger.log(`Backend running on 0.0.0.0:${port}`);
}

bootstrap();
