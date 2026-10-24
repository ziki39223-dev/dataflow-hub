import { ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { BizException } from '../exceptions/business.exception';
import { JwtPayload } from '../types/jwt-payload.interface';
import { RedisService } from '../../modules/redis/redis.service';

/**
 * JWT 鉴权守卫
 * - 解析 Bearer Token
 * - 校验签名、有效期
 * - 校验 Redis 黑名单
 * - 将用户信息挂载到 request.user
 */
@Injectable()
export class JwtAuthGuard {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly redisService: RedisService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extractToken(request);
    if (!token) throw BizException.unauthorized();

    let payload: JwtPayload;
    try {
      payload = this.jwtService.verify<JwtPayload>(token, {
        secret: this.configService.get<string>('jwt.accessSecret'),
      });
    } catch (err: any) {
      if (err?.name === 'TokenExpiredError') throw BizException.tokenExpired();
      throw BizException.tokenInvalid();
    }

    // 校验黑名单(jti)
    const jti = (payload as any).jti as string | undefined;
    if (jti && (await this.redisService.isTokenBlacklisted(jti))) {
      throw BizException.tokenBlacklisted();
    }

    (request as any).user = {
      userId: payload.userId,
      email: payload.email,
      role: payload.role,
      companyId: payload.companyId,
    };
    return true;
  }

  private extractToken(request: Request): string | null {
    const authHeader = request.headers.authorization;
    if (!authHeader) return null;
    const [type, token] = authHeader.split(' ');
    return type === 'Bearer' && token ? token : null;
  }
}
