import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@prisma/client';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { BizException } from '../exceptions/business.exception';
import { CurrentUser } from '../types/jwt-payload.interface';

/**
 * 角色权限守卫 (RBAC)
 * 需配合 @Roles() 装饰器使用
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    // 未配置角色要求,则放行
    if (!requiredRoles || requiredRoles.length === 0) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user as CurrentUser | undefined;
    if (!user) throw BizException.unauthorized();

    if (!requiredRoles.includes(user.role)) {
      throw BizException.roleForbidden(
        `当前角色 ${user.role} 无权访问,需要 ${requiredRoles.join('/')} 角色`,
      );
    }
    return true;
  }
}
