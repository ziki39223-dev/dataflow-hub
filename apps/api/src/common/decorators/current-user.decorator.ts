import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { CurrentUser } from '../types/jwt-payload.interface';

/**
 * 从请求中获取当前登录用户
 * @example @CurrentUser() user: CurrentUser
 * @example @CurrentUser('userId') userId: number
 */
export const CurrentUserDecorator = createParamDecorator(
  (data: keyof CurrentUser | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user as CurrentUser | undefined;
    return data ? user?.[data] : user;
  },
);
