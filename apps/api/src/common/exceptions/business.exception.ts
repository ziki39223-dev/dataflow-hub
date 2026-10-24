import { HttpException, HttpStatus } from '@nestjs/common';
import { ErrorCode, errorCodeToHttp, errorMessageMap } from '../constants/error-codes';

/**
 * 业务异常
 * 抛出后会被全局过滤器统一处理为统一响应格式
 */
export class BusinessException extends HttpException {
  readonly code: number;
  readonly detail?: unknown;

  constructor(code: number, message?: string, detail?: unknown) {
    const httpStatus = errorCodeToHttp[code] ?? HttpStatus.INTERNAL_SERVER_ERROR;
    const msg = message || errorMessageMap[code] || '未知错误';
    super({ code, message: msg, detail }, httpStatus);
    this.code = code;
    this.detail = detail;
  }

  static throw(code: number, message?: string, detail?: unknown): never {
    throw new BusinessException(code, message, detail);
  }
}

/** 快捷构造常用业务异常 */
export const BizException = {
  unauthorized: (msg?: string) => new BusinessException(ErrorCode.UNAUTHORIZED, msg),
  forbidden: (msg?: string) => new BusinessException(ErrorCode.FORBIDDEN, msg),
  roleForbidden: (msg?: string) => new BusinessException(ErrorCode.ROLE_FORBIDDEN, msg),
  notFound: (msg?: string) => new BusinessException(ErrorCode.NOT_FOUND, msg),
  badRequest: (msg?: string) => new BusinessException(ErrorCode.BAD_REQUEST, msg),
  conflict: (msg?: string) => new BusinessException(ErrorCode.CONFLICT, msg),
  tokenExpired: () => new BusinessException(ErrorCode.TOKEN_EXPIRED),
  tokenInvalid: () => new BusinessException(ErrorCode.TOKEN_INVALID),
  tokenBlacklisted: () => new BusinessException(ErrorCode.TOKEN_BLACKLISTED),
  userExists: () => new BusinessException(ErrorCode.USER_EXISTS),
  userNotFound: () => new BusinessException(ErrorCode.USER_NOT_FOUND),
  passwordIncorrect: () => new BusinessException(ErrorCode.PASSWORD_INCORRECT),
  userInactive: () => new BusinessException(ErrorCode.USER_INACTIVE),
  projectNotFound: () => new BusinessException(ErrorCode.PROJECT_NOT_FOUND),
  taskNotFound: () => new BusinessException(ErrorCode.TASK_NOT_FOUND),
  taskStatusInvalid: () => new BusinessException(ErrorCode.TASK_STATUS_INVALID),
  diaryNotFound: () => new BusinessException(ErrorCode.DIARY_NOT_FOUND),
  memoryNotFound: () => new BusinessException(ErrorCode.MEMORY_NOT_FOUND),
  reportNotFound: () => new BusinessException(ErrorCode.REPORT_NOT_FOUND),
  internal: (msg?: string) => new BusinessException(ErrorCode.INTERNAL_ERROR, msg),
};
