import { Injectable, Logger } from '@nestjs/common';
import { Prisma, UserRole } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { RedisService } from 'src/modules/redis/redis.service';
import { BizException } from 'src/common/exceptions/business.exception';
import { CurrentUser } from 'src/common/types/jwt-payload.interface';
import { PaginationDto } from 'src/common/dto/pagination.dto';
import { PaginatedData, PaginatedResponse } from 'src/common/utils/api-response';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';

/** 缓存 TTL(秒) */
const CACHE_LIST_TTL = 60;
const CACHE_DETAIL_TTL = 120;

@Injectable()
export class ProjectsService {
  private readonly logger = new Logger(ProjectsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
  ) {}

  /** 解析排序参数,格式如 "createdAt:desc" */
  private parseSort(sort?: string): Prisma.ProjectOrderByWithRelationInput {
    if (!sort) return { createdAt: 'desc' };
    const [field, direction] = sort.split(':');
    if (!field) return { createdAt: 'desc' };
    return { [field]: direction === 'desc' ? 'desc' : 'asc' };
  }

  /** 生成列表缓存 key */
  private listCacheKey(userId: number, page: number, pageSize: number, keyword?: string): string {
    return `project:list:${userId}:${page}:${pageSize}:${keyword || 'all'}`;
  }

  /** 生成详情缓存 key */
  private detailCacheKey(id: number): string {
    return `project:detail:${id}`;
  }

  /** 创建项目 */
  async create(dto: CreateProjectDto, currentUser: CurrentUser) {
    const project = await this.prisma.project.create({
      data: {
        name: dto.name,
        description: dto.description,
        ownerId: currentUser.userId,
        companyId: currentUser.companyId ?? null,
      },
      include: {
        owner: { select: { id: true, email: true, name: true } },
        _count: { select: { tasks: true } },
      },
    });

    // 创建后失效所有列表缓存
    await this.redisService.invalidatePattern('project:list:*');
    this.logger.log(`用户 ${currentUser.userId} 创建项目 ${project.id}`);
    return project;
  }

  /** 分页查询项目(带缓存) */
  async findAll(query: PaginationDto, currentUser: CurrentUser) {
    const { page = 1, pageSize = 20, skip, take, keyword, sort } = query;
    const cacheKey = this.listCacheKey(currentUser.userId, page, pageSize, keyword);

    // 先查 Redis 缓存
    const cached = await this.redisService.getCachedJson<PaginatedData<unknown>>(cacheKey);
    if (cached) {
      return cached;
    }

    // 构建查询条件:当前用户作为 owner 或同公司的项目
    const where: Prisma.ProjectWhereInput = {
      AND: [
        {
          OR: [
            { ownerId: currentUser.userId },
            ...(currentUser.companyId ? [{ companyId: currentUser.companyId }] : []),
          ],
        },
      ],
    };

    // 关键字搜索 name/description
    if (keyword) {
      (where.AND as Prisma.ProjectWhereInput[]).push({
        OR: [
          { name: { contains: keyword, mode: 'insensitive' } },
          { description: { contains: keyword, mode: 'insensitive' } },
        ],
      });
    }

    const orderBy = this.parseSort(sort);

    const [list, total] = await Promise.all([
      this.prisma.project.findMany({
        where,
        skip,
        take,
        orderBy,
        include: {
          owner: { select: { id: true, email: true, name: true } },
          _count: { select: { tasks: true } },
        },
      }),
      this.prisma.project.count({ where }),
    ]);

    const result = PaginatedResponse.create(list, total, page, pageSize);

    // 写入缓存
    await this.redisService.cacheJson(cacheKey, result, CACHE_LIST_TTL);
    return result;
  }

  /** 查询单个项目(带缓存) */
  async findOne(id: number) {
    const cacheKey = this.detailCacheKey(id);

    // 先查缓存
    const cached = await this.redisService.getCachedJson(cacheKey);
    if (cached) return cached;

    const project = await this.prisma.project.findUnique({
      where: { id },
      include: {
        owner: { select: { id: true, email: true, name: true } },
        _count: { select: { tasks: true } },
      },
    });

    if (!project) throw BizException.projectNotFound();

    // 写入缓存
    await this.redisService.cacheJson(cacheKey, project, CACHE_DETAIL_TTL);
    return project;
  }

  /** 更新项目(仅 owner 或 ADMIN) */
  async update(id: number, dto: UpdateProjectDto, currentUser: CurrentUser) {
    const project = await this.prisma.project.findUnique({ where: { id } });
    if (!project) throw BizException.projectNotFound();

    // 仅 owner 或 ADMIN 可更新
    const isAdmin = currentUser.role === UserRole.ADMIN;
    if (project.ownerId !== currentUser.userId && !isAdmin) {
      throw BizException.roleForbidden('只有项目所有者或管理员可更新项目');
    }

    const updated = await this.prisma.project.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
      },
      include: {
        owner: { select: { id: true, email: true, name: true } },
        _count: { select: { tasks: true } },
      },
    });

    // 失效相关缓存
    await this.redisService.del(this.detailCacheKey(id));
    await this.redisService.invalidatePattern('project:list:*');

    return updated;
  }

  /** 删除项目(仅 owner 或 ADMIN) */
  async remove(id: number, currentUser: CurrentUser) {
    const project = await this.prisma.project.findUnique({ where: { id } });
    if (!project) throw BizException.projectNotFound();

    const isAdmin = currentUser.role === UserRole.ADMIN;
    if (project.ownerId !== currentUser.userId && !isAdmin) {
      throw BizException.roleForbidden('只有项目所有者或管理员可删除项目');
    }

    await this.prisma.project.delete({ where: { id } });

    // 失效缓存
    await this.redisService.del(this.detailCacheKey(id));
    await this.redisService.invalidatePattern('project:list:*');

    this.logger.log(`用户 ${currentUser.userId} 删除项目 ${id}`);
    return { success: true };
  }
}
