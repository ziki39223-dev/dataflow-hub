import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from 'src/prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import * as bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { UserRole } from '@prisma/client';
import { BizException } from 'src/common/exceptions/business.exception';
import { JwtPayload } from 'src/common/types/jwt-payload.interface';
import { LoginDto, RegisterDto } from './dto/register.dto';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface AuthResult extends AuthTokens {
  user: {
    id: number;
    email: string;
    name: string | null;
    role: UserRole;
    companyId: number | null;
  };
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly redisService: RedisService,
  ) {}

  async register(dto: RegisterDto): Promise<AuthResult> {
    // 检查邮箱是否已存在
    const exists = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (exists) throw BizException.userExists();

    // 查找或创建公司
    let company: { id: number } | null = null;
    if (dto.company) {
      company = await this.prisma.company.upsert({
        where: { name: dto.company },
        update: {},
        create: {
          name: dto.company,
          code: `${dto.company}-${Date.now().toString(36)}`,
        },
        select: { id: true },
      });
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);
    const isFirstUser = (await this.prisma.user.count()) === 0;

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        password: hashedPassword,
        name: dto.name || dto.email.split('@')[0],
        role: isFirstUser ? UserRole.ADMIN : UserRole.MEMBER,
        companyId: company?.id ?? null,
      },
    });

    this.logger.log(`新用户注册: ${user.email} (role=${user.role})`);
    return this.issueTokens(user.id, user.email, user.role, {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      companyId: user.companyId,
    });
  }

  async login(dto: LoginDto): Promise<AuthResult> {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user) throw BizException.userNotFound();
    if (!user.isActive) throw BizException.userInactive();

    const passwordValid = await bcrypt.compare(dto.password, user.password);
    if (!passwordValid) throw BizException.passwordIncorrect();

    return this.issueTokens(user.id, user.email, user.role, {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      companyId: user.companyId,
    });
  }

  async refresh(refreshToken: string): Promise<AuthTokens> {
    let payload: { userId: number; email: string; role: UserRole; tokenId: string };
    try {
      payload = this.jwtService.verify(refreshToken, {
        secret: this.configService.get<string>('jwt.refreshSecret'),
      });
    } catch {
      throw new UnauthorizedException('刷新令牌无效或已过期');
    }

    // 校验数据库中刷新令牌是否有效
    const stored = await this.prisma.refreshToken.findFirst({
      where: { token: refreshToken, userId: payload.userId, revoked: false },
    });
    if (!stored || stored.expiresAt < new Date()) {
      throw BizException.conflict('刷新令牌已失效');
    }

    // 撤销旧刷新令牌(轮转)
    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revoked: true },
    });

    return this.generateTokens(payload.userId, payload.email, payload.role);
  }

  async logout(userId: number, accessToken: string, jti?: string): Promise<void> {
    // 撤销该用户所有未过期的刷新令牌
    await this.prisma.refreshToken.updateMany({
      where: { userId, revoked: false },
      data: { revoked: true },
    });

    // access token 加入黑名单(直到过期)
    if (jti) {
      const decoded = this.jwtService.decode(accessToken) as { exp?: number } | null;
      const ttl = decoded?.exp ? Math.max(decoded.exp - Math.floor(Date.now() / 1000), 0) : 900;
      await this.redisService.blacklistToken(jti, ttl);
    }
    this.logger.log(`用户 ${userId} 退出登录`);
  }

  private async issueTokens(
    userId: number,
    email: string,
    role: UserRole,
    userProfile: { id: number; email: string; name: string | null; role: UserRole; companyId: number | null },
  ): Promise<AuthResult> {
    const tokens = await this.generateTokens(userId, email, role);
    return { ...tokens, user: userProfile };
  }

  private async generateTokens(
    userId: number,
    email: string,
    role: UserRole,
  ): Promise<AuthTokens> {
    const payload: JwtPayload & { jti: string } = {
      userId,
      email,
      role,
      jti: uuidv4(),
    };

    const accessToken = this.jwtService.sign(payload, {
      secret: this.configService.get<string>('jwt.accessSecret'),
      expiresIn: this.configService.get<string>('jwt.accessExpiresIn'),
    });

    const refreshToken = this.jwtService.sign(
      { userId, email, role, tokenId: uuidv4() },
      {
        secret: this.configService.get<string>('jwt.refreshSecret'),
        expiresIn: this.configService.get<string>('jwt.refreshExpiresIn'),
      },
    );

    // 解析过期时长(秒)
    const expiresInStr = this.configService.get<string>('jwt.accessExpiresIn') || '15m';
    const expiresIn = this.parseExpiresIn(expiresInStr);

    // 持久化刷新令牌
    const refreshExpiresInStr = this.configService.get<string>('jwt.refreshExpiresIn') || '7d';
    const refreshTtl = this.parseExpiresIn(refreshExpiresInStr);
    await this.prisma.refreshToken.create({
      data: {
        userId,
        token: refreshToken,
        expiresAt: new Date(Date.now() + refreshTtl * 1000),
      },
    });

    return { accessToken, refreshToken, expiresIn };
  }

  private parseExpiresIn(input: string): number {
    const match = input.match(/^(\d+)([smhd])$/);
    if (!match) return 900;
    const value = parseInt(match[1], 10);
    const unit = match[2];
    const multipliers: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400 };
    return value * (multipliers[unit] ?? 1);
  }
}
