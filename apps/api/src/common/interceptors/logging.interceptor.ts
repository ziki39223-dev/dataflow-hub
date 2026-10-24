import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Request } from 'express';
import { Observable, tap } from 'rxjs';

/**
 * 请求日志拦截器
 * 记录 request_id / user_id / api / duration
 */
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();
    const { method, url, ip } = request;
    const userAgent = request.get('user-agent') || '-';
    const requestId = (request.headers['x-request-id'] as string) || '-';
    const userId = (request as any).user?.userId || '-';
    const now = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const duration = Date.now() - now;
          this.logger.log(
            `[${requestId}] ${method} ${url} ${ip} ${userAgent} user=${userId} ${duration}ms`,
          );
        },
        error: (err) => {
          const duration = Date.now() - now;
          this.logger.error(
            `[${requestId}] ${method} ${url} user=${userId} ${duration}ms ERROR: ${err.message}`,
          );
        },
      }),
    );
  }
}
