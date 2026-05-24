import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';

@Catch()
export class HttpSanitizingExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpSanitizingExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const isProd = process.env.NODE_ENV === 'production';

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      res.status(status).json(body);
      return;
    }

    const err = exception instanceof Error ? exception : new Error(String(exception));
    this.logger.error(err.message, err.stack);

    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json(
      isProd
        ? {
            statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
            message: 'An unexpected error occurred.',
          }
        : {
            statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
            message: err.message,
          },
    );
  }
}
