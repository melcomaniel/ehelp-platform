import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';

/**
 * Logs every HTTP exception (and unexpected errors) so mobile/web failures
 * are visible in the Nest terminal — Nest's default filter is silent for 4xx.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly log = new Logger('HTTP');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<
      Request & { user?: { sub?: string; role?: string } }
    >();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const exceptionResponse =
      exception instanceof HttpException ? exception.getResponse() : null;

    let message: string | string[] = 'Internal server error';
    let extra: Record<string, unknown> | undefined;

    if (typeof exceptionResponse === 'string') {
      message = exceptionResponse;
    } else if (exceptionResponse && typeof exceptionResponse === 'object') {
      const body = exceptionResponse as Record<string, unknown>;
      if (body.message != null) {
        message = body.message as string | string[];
      }
      const { message: _m, statusCode: _s, error: _e, ...rest } = body;
      if (Object.keys(rest).length) extra = rest;
    } else if (exception instanceof Error) {
      message = exception.message;
    }

    const platform = String(req.headers['x-client-platform'] ?? '-');
    const user = req.user?.sub
      ? `${req.user.sub.slice(0, 8)}…(${req.user.role ?? '?'})`
      : '-';
    const msgText = Array.isArray(message)
      ? message.join('; ')
      : String(message);
    const line = `${req.method} ${req.originalUrl || req.url} → ${status} | platform=${platform} user=${user} | ${msgText}`;

    if (status >= 500) {
      this.log.error(
        line,
        exception instanceof Error ? exception.stack : undefined,
      );
    } else if (status >= 400) {
      this.log.warn(line + (extra ? ` ${JSON.stringify(extra)}` : ''));
    } else {
      this.log.log(line);
    }

    const payload =
      exception instanceof HttpException
        ? exception.getResponse()
        : {
            statusCode: status,
            message: 'Internal server error',
          };

    // Avoid double-send if headers already flushed
    if (!res.headersSent) {
      res
        .status(status)
        .json(
          typeof payload === 'string'
            ? { statusCode: status, message: payload }
            : payload,
        );
    }
  }
}
