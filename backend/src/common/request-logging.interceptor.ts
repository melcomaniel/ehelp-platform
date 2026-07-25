import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { Observable, tap } from 'rxjs';

/**
 * Access-style request log for every completed Nest handler.
 * Pair with AllExceptionsFilter so failures are logged too.
 */
@Injectable()
export class RequestLoggingInterceptor implements NestInterceptor {
  private readonly log = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const req = http.getRequest<
      Request & { user?: { sub?: string; role?: string } }
    >();
    const res = http.getResponse<Response>();
    const started = Date.now();

    const platform = String(req.headers['x-client-platform'] ?? '-');
    const user = req.user?.sub
      ? `${req.user.sub.slice(0, 8)}…(${req.user.role ?? '?'})`
      : '-';

    return next.handle().pipe(
      tap({
        next: () => {
          const ms = Date.now() - started;
          this.log.log(
            `${req.method} ${req.originalUrl || req.url} → ${res.statusCode} ${ms}ms | platform=${platform} user=${user}`,
          );
        },
        // Errors are logged by AllExceptionsFilter; avoid duplicate noise here.
        error: () => undefined,
      }),
    );
  }
}
