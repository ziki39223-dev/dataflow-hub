import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { BizException } from 'src/common/exceptions/business.exception';
import { RegisterDto, LoginDto } from './dto/register.dto';

describe('AuthService', () => {
  let service: AuthService;
  let prisma: jest.Mocked<PrismaService>;
  let jwtService: jest.Mocked<JwtService>;
  let redisService: jest.Mocked<RedisService>;
  let configService: jest.Mocked<ConfigService>;

  beforeEach(async () => {
    const prismaMock = {
      user: {
        findUnique: jest.fn(),
        create: jest.fn(),
        count: jest.fn(),
      },
      company: {
        upsert: jest.fn(),
      },
      refreshToken: {
        create: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
    };
    const jwtMock = {
      sign: jest.fn().mockReturnValue('mock-token'),
      verify: jest.fn(),
      decode: jest.fn().mockReturnValue({ exp: Math.floor(Date.now() / 1000) + 900 }),
    };
    const redisMock = {
      blacklistToken: jest.fn(),
      isTokenBlacklisted: jest.fn(),
    };
    const configMock = {
      get: jest.fn((key: string) => {
        const map: Record<string, string> = {
          'jwt.accessSecret': 'access-secret',
          'jwt.accessExpiresIn': '15m',
          'jwt.refreshSecret': 'refresh-secret',
          'jwt.refreshExpiresIn': '7d',
        };
        return map[key];
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: JwtService, useValue: jwtMock },
        { provide: RedisService, useValue: redisMock },
        { provide: ConfigService, useValue: configMock },
      ],
    }).compile();

    service = module.get(AuthService);
    prisma = module.get(PrismaService);
    jwtService = module.get(JwtService);
    redisService = module.get(RedisService);
    configService = module.get(ConfigService);
  });

  describe('register', () => {
    it('应成功注册新用户', async () => {
      const dto: RegisterDto = {
        email: 'new@test.com',
        password: '123456',
        company: 'demo',
        name: '测试用户',
      };
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.company.upsert.mockResolvedValue({ id: 1 } as any);
      prisma.user.count.mockResolvedValue(1); // 非首个用户
      prisma.user.create.mockResolvedValue({
        id: 10,
        email: dto.email,
        name: dto.name,
        role: 'MEMBER',
        companyId: 1,
        password: 'hashed',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);
      prisma.refreshToken.create.mockResolvedValue({} as any);

      const result = await service.register(dto);

      expect(result.user.email).toBe(dto.email);
      expect(result.accessToken).toBe('mock-token');
      expect(result.refreshToken).toBe('mock-token');
      expect(prisma.user.create).toHaveBeenCalled();
    });

    it('邮箱已存在时应抛出 USER_EXISTS', async () => {
      const dto: RegisterDto = { email: 'exists@test.com', password: '123456' };
      prisma.user.findUnique.mockResolvedValue({ id: 1 } as any);

      await expect(service.register(dto)).rejects.toThrow(BizException);
      expect(prisma.user.create).not.toHaveBeenCalled();
    });
  });

  describe('login', () => {
    it('凭据正确时应返回 token', async () => {
      const dto: LoginDto = { email: 'admin@dataflow.dev', password: 'admin123' };
      const hashed = await bcrypt.hash('admin123', 10);
      prisma.user.findUnique.mockResolvedValue({
        id: 1,
        email: dto.email,
        name: '管理员',
        role: 'ADMIN',
        companyId: 1,
        password: hashed,
        isActive: true,
      } as any);
      prisma.refreshToken.create.mockResolvedValue({} as any);

      const result = await service.login(dto);

      expect(result.accessToken).toBe('mock-token');
      expect(result.user.id).toBe(1);
    });

    it('用户不存在时应抛出 USER_NOT_FOUND', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(
        service.login({ email: 'none@test.com', password: '123456' }),
      ).rejects.toThrow(BizException);
    });

    it('密码错误时应抛出 PASSWORD_INCORRECT', async () => {
      const hashed = await bcrypt.hash('correct', 10);
      prisma.user.findUnique.mockResolvedValue({
        id: 1,
        email: 'x@x.com',
        role: 'MEMBER',
        password: hashed,
        isActive: true,
      } as any);
      await expect(
        service.login({ email: 'x@x.com', password: 'wrong' }),
      ).rejects.toThrow(BizException);
    });

    it('用户被禁用时应抛出 USER_INACTIVE', async () => {
      const hashed = await bcrypt.hash('123456', 10);
      prisma.user.findUnique.mockResolvedValue({
        id: 1,
        email: 'x@x.com',
        role: 'MEMBER',
        password: hashed,
        isActive: false,
      } as any);
      await expect(
        service.login({ email: 'x@x.com', password: '123456' }),
      ).rejects.toThrow(BizException);
    });
  });

  describe('logout', () => {
    it('应撤销刷新令牌并将 access token 加入黑名单', async () => {
      prisma.refreshToken.updateMany.mockResolvedValue({ count: 2 } as any);
      redisService.blacklistToken.mockResolvedValue(undefined);

      await service.logout(1, 'access-token', 'jti-123');

      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { userId: 1, revoked: false },
        data: { revoked: true },
      });
      expect(redisService.blacklistToken).toHaveBeenCalled();
    });
  });
});
