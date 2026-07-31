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

  const port = Number(config.get('PORT') ?? 3001);
  // Bind all interfaces so a physical phone on the same Wi‑Fi can reach the Mac.
  await app.listen(port, '0.0.0.0');
  const mode = (config.get<string>('AUTH_PROVIDER_MODE') ?? 'mock')
    .trim()
    .toLowerCase();
  boot.log(`EHELP Core listening on http://0.0.0.0:${port}`);
  boot.log(`Uploads served at /uploads/ → ${uploadsDir}`);
  boot.log(
    `AUTH_PROVIDER_MODE=${mode}` +
      (mode === 'live'
        ? ' → real eGov SSO + Face Liveness camera + PhilSys eVerify'
        : ' → mock adapters (no camera / auto-pass). Change .env then fully restart Nest.'),
  );
  boot.log(
    'HTTP request + error logging enabled. Failures that never reach Nest (wrong host, offline) will not appear here.',
  );
}
bootstrap();
