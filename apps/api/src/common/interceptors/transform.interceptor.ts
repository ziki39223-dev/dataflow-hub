import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { SKIP_TRANSFORM_KEY } from '../decorators/skip-transform.decorator';

/**
 * 响应转换拦截器
 * 将 controller 返回值包装成统一结构 { code: 0, data, message }
 */
@Injectable()
export class TransformInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const skipTransform = this.reflector.getAllAndOverride<boolean>(SKIP_TRANSFORM_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    return next.handle().pipe(
      map((data) => {
        if (skipTransform) {
          return data;
        }
        // 已经是统一结构则直接返回
        if (data && typeof data === 'object' && 'code' in data && 'data' in data) {
          return data;
        }
        return {
          code: 0,
          message: 'success',
          data,
          timestamp: Date.now(),
        };
      }),
    );
  }
}
