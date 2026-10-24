import { UserRole } from '@prisma/client';

/** JWT Access Token 载荷 */
export interface JwtPayload {
  userId: number;
  email: string;
  role: UserRole;
  companyId?: number | null;
  iat?: number;
  exp?: number;
}

/** 请求上下文中当前用户信息 */
export interface CurrentUser {
  userId: number;
  email: string;
  role: UserRole;
  companyId?: number | null;
}
