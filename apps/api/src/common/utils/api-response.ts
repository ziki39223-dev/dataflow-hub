/**
 * 统一响应结构
 * 成功: { code: 0, data: {}, message?: 'success' }
 * 失败: { code: 40001, message: '...' }
 */
export interface ApiResponse<T = unknown> {
  code: number;
  message: string;
  data?: T;
  timestamp?: number;
}

export class ApiResponseUtil {
  static success<T>(data?: T, message = 'success'): ApiResponse<T> {
    return {
      code: 0,
      message,
      data,
      timestamp: Date.now(),
    };
  }

  static error(code: number, message: string, detail?: unknown): ApiResponse<unknown> {
    return {
      code,
      message,
      data: detail,
      timestamp: Date.now(),
    };
  }
}

/** 分页响应数据结构 */
export interface PaginatedData<T> {
  list: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export class PaginatedResponse {
  static create<T>(
    list: T[],
    total: number,
    page: number,
    pageSize: number,
  ): PaginatedData<T> {
    return {
      list,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize) || 0,
    };
  }
}
