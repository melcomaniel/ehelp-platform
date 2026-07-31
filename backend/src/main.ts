import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/http-exception.filter';
import { RequestLoggingInterceptor } from './common/request-logging.interceptor';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: ['error', 'warn', 'log', 'debug'],
  });
  const config = app.get(ConfigService);
  const boot = new Logger('Bootstrap');

  const uploadsDir = join(process.cwd(), 'uploads');
  if (!existsSync(uploadsDir)) {
    mkdirSync(uploadsDir, { recursive: true });
  }
  app.useStaticAssets(uploadsDir, { prefix: '/uploads/' });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(new RequestLoggingInterceptor());

  const origins = config.get<string>('CORS_ORIGINS') ?? '*';
  app.enableCors({
    origin: origins === '*' ? true : origins.split(','),
  });

  // Prefer process.env.PORT (Render/Fly inject this). Empty/invalid → 3001.
  const rawPort = process.env.PORT ?? config.get<string>('PORT') ?? '3001';
  const port = Number.parseInt(String(rawPort).trim(), 10);
  const listenPort =
    Number.isFinite(port) && port >= 0 && port < 65536 ? port : 3001;
  // Bind all interfaces so a physical phone on the same Wi‑Fi can reach the Mac.
  await app.listen(listenPort, '0.0.0.0');
  const {
    authAdapterMode,
    baseAuthProviderMode,
  } = await import('./auth/auth-provider-mode');
  const base = baseAuthProviderMode(config);
  const sso = authAdapterMode(config, 'AUTH_SSO_MODE');
  const everify = authAdapterMode(config, 'AUTH_EVERIFY_MODE');
  const liveness = authAdapterMode(config, 'AUTH_LIVENESS_MODE');
  boot.log(`EHELP Core listening on http://0.0.0.0:${listenPort}`);
  boot.log(`Uploads served at /uploads/ → ${uploadsDir}`);
  boot.log(
    `Auth adapters: base=${base} sso=${sso} everify=${everify} liveness=${liveness}` +
      (liveness === 'live'
        ? ' → real Face Liveness camera'
        : ' → mock liveness (auto-pass)'),
  );
  boot.log(
    'HTTP request + error logging enabled. Failures that never reach Nest (wrong host, offline) will not appear here.',
  );
}
bootstrap();
