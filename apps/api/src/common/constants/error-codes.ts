/**
 * 统一业务错误码定义
 * 规则: HTTP 相关 4 位以内,业务错误 5 位
 */
export const ErrorCode = {
  // ===== 通用成功 =====
  SUCCESS: 0,

  // ===== 客户端错误 (40000+) =====
  BAD_REQUEST: 40000,
  VALIDATION_ERROR: 40001,
  UNAUTHORIZED: 40100,
  TOKEN_EXPIRED: 40101,
  TOKEN_INVALID: 40102,
  TOKEN_BLACKLISTED: 40103,
  REFRESH_TOKEN_INVALID: 40104,
  FORBIDDEN: 40300,
  ROLE_FORBIDDEN: 40301,
  NOT_FOUND: 40400,
  METHOD_NOT_ALLOWED: 40500,
  CONFLICT: 40900,

  // ===== 业务错误 (41000+) =====
  USER_EXISTS: 41001,
  USER_NOT_FOUND: 41002,
  PASSWORD_INCORRECT: 41003,
  USER_INACTIVE: 41004,
  PROJECT_NOT_FOUND: 41101,
  TASK_NOT_FOUND: 41201,
  TASK_STATUS_INVALID: 41202,
  DIARY_NOT_FOUND: 41301,
  MEMORY_NOT_FOUND: 41401,
  REPORT_NOT_FOUND: 41501,

  // ===== 服务端错误 (50000+) =====
  INTERNAL_ERROR: 50000,
  DATABASE_ERROR: 50001,
  REDIS_ERROR: 50002,
  RABBITMQ_ERROR: 50003,
  AI_PROVIDER_ERROR: 50004,
  EXTERNAL_SERVICE_ERROR: 50005,
} as const;

export type ErrorCodeType = (typeof ErrorCode)[keyof typeof ErrorCode];

/** 错误码到 HTTP 状态码映射 */
export const errorCodeToHttp: Record<number, number> = {
  [ErrorCode.SUCCESS]: 200,
  [ErrorCode.BAD_REQUEST]: 400,
  [ErrorCode.VALIDATION_ERROR]: 400,
  [ErrorCode.UNAUTHORIZED]: 401,
  [ErrorCode.TOKEN_EXPIRED]: 401,
  [ErrorCode.TOKEN_INVALID]: 401,
  [ErrorCode.TOKEN_BLACKLISTED]: 401,
  [ErrorCode.REFRESH_TOKEN_INVALID]: 401,
  [ErrorCode.FORBIDDEN]: 403,
  [ErrorCode.ROLE_FORBIDDEN]: 403,
  [ErrorCode.NOT_FOUND]: 404,
  [ErrorCode.METHOD_NOT_ALLOWED]: 405,
  [ErrorCode.CONFLICT]: 409,
  [ErrorCode.USER_EXISTS]: 409,
  [ErrorCode.PROJECT_NOT_FOUND]: 404,
  [ErrorCode.TASK_NOT_FOUND]: 404,
  [ErrorCode.DIARY_NOT_FOUND]: 404,
  [ErrorCode.MEMORY_NOT_FOUND]: 404,
  [ErrorCode.REPORT_NOT_FOUND]: 404,
};

/** 默认错误消息 */
export const errorMessageMap: Record<number, string> = {
  [ErrorCode.BAD_REQUEST]: '请求参数错误',
  [ErrorCode.VALIDATION_ERROR]: '数据校验失败',
  [ErrorCode.UNAUTHORIZED]: '未授权,请先登录',
  [ErrorCode.TOKEN_EXPIRED]: 'token 已过期',
  [ErrorCode.TOKEN_INVALID]: 'token 无效',
  [ErrorCode.TOKEN_BLACKLISTED]: 'token 已失效,请重新登录',
  [ErrorCode.REFRESH_TOKEN_INVALID]: '刷新令牌无效',
  [ErrorCode.FORBIDDEN]: '禁止访问',
  [ErrorCode.ROLE_FORBIDDEN]: '权限不足',
  [ErrorCode.NOT_FOUND]: '资源不存在',
  [ErrorCode.CONFLICT]: '资源冲突',
  [ErrorCode.USER_EXISTS]: '用户已存在',
  [ErrorCode.USER_NOT_FOUND]: '用户不存在',
  [ErrorCode.PASSWORD_INCORRECT]: '密码错误',
  [ErrorCode.USER_INACTIVE]: '用户已被禁用',
  [ErrorCode.PROJECT_NOT_FOUND]: '项目不存在',
  [ErrorCode.TASK_NOT_FOUND]: '任务不存在',
  [ErrorCode.TASK_STATUS_INVALID]: '任务状态非法',
  [ErrorCode.INTERNAL_ERROR]: '服务器内部错误',
  [ErrorCode.DATABASE_ERROR]: '数据库错误',
  [ErrorCode.REDIS_ERROR]: '缓存服务错误',
  [ErrorCode.RABBITMQ_ERROR]: '消息队列错误',
  [ErrorCode.AI_PROVIDER_ERROR]: 'AI 服务调用失败',
};
