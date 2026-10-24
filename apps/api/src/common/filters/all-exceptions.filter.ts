import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Request, Response } from 'express';
import { ErrorCode, errorMessageMap } from '../constants/error-codes';
import { BusinessException } from '../exceptions/business.exception';

/**
 * 全局异常过滤器
 * 统一处理所有异常,转换为标准响应结构
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const requestId = (request.headers['x-request-id'] as string) || '-';

    let httpStatus = HttpStatus.INTERNAL_SERVER_ERROR;
    let code: number = ErrorCode.INTERNAL_ERROR;
    let message = errorMessageMap[ErrorCode.INTERNAL_ERROR];
    let detail: unknown;

    if (exception instanceof BusinessException) {
      httpStatus = exception.getStatus();
      const res = exception.getResponse() as { code: number; message: string; detail?: unknown };
      code = res.code;
      message = res.message;
      detail = res.detail;
    } else if (exception instanceof HttpException) {
      httpStatus = exception.getStatus();
      const res = exception.getResponse();
      if (typeof res === 'string') {
        message = res;
        code = httpStatus * 100;
      } else if (typeof res === 'object' && res !== null) {
        const r = res as Record<string, unknown>;
        message =
          (r.message as string | string[]) instanceof Array
            ? (r.message as string[]).join('; ')
            : (r.message as string) || message;
        if (r.code && typeof r.code === 'number') code = r.code;
        else code = httpStatus * 100;
      }
    } else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      // Prisma 已知错误
      if (exception.code === 'P2002') {
        httpStatus = HttpStatus.CONFLICT;
        code = ErrorCode.CONFLICT;
        message = '数据唯一约束冲突';
      } else if (exception.code === 'P2025') {
        httpStatus = HttpStatus.NOT_FOUND;
        code = ErrorCode.NOT_FOUND;
        message = '记录不存在';
      } else {
        httpStatus = HttpStatus.BAD_REQUEST;
        code = ErrorCode.DATABASE_ERROR;
        message = `数据库错误: ${exception.code}`;
      }
      detail = { prismaCode: exception.code };
    } else if (exception instanceof Error) {
      message = exception.message;
      this.logger.error(
        `未处理异常: ${exception.message}\n${exception.stack}`,
        `RequestId: ${requestId}`,
      );
    }

    // 4xx 记录 warn,5xx 记录 error
    if (httpStatus >= 500) {
      this.logger.error(
        `[${requestId}] ${request.method} ${request.url} -> ${httpStatus} code=${code} msg=${message}`,
        exception instanceof Error ? exception.stack : undefined,
      );
    } else if (httpStatus >= 400) {
      this.logger.warn(
        `[${requestId}] ${request.method} ${request.url} -> ${httpStatus} code=${code} msg=${message}`,
      );
    }

    response.status(httpStatus).json({
      code,
      message,
      ...(detail ? { detail } : {}),
      path: request.url,
      method: request.method,
      requestId,
      timestamp: new Date().toISOString(),
    });
  }
}
