import { Injectable, Logger } from '@nestjs/common';
import { Prisma, UserRole } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { BizException } from 'src/common/exceptions/business.exception';
import { CurrentUser } from 'src/common/types/jwt-payload.interface';
import { PaginatedResponse } from 'src/common/utils/api-response';
import { CreateMemoryDto } from './dto/create-memory.dto';
import { UpdateMemoryDto } from './dto/update-memory.dto';
import { QueryMemoryDto } from './dto/query-memory.dto';

@Injectable()
export class MemoryService {
  private readonly logger = new Logger(MemoryService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** 解析排序参数,格式如 "createdAt:desc" */
  private parseSort(sort?: string): Prisma.MemoryOrderByWithRelationInput {
    if (!sort) return { createdAt: 'desc' };
    const [field, direction] = sort.split(':');
    if (!field) return { createdAt: 'desc' };
    return { [field]: direction === 'desc' ? 'desc' : 'asc' };
  }

  /** 创建记忆 */
  async create(dto: CreateMemoryDto, currentUser: CurrentUser) {
    const memory = await this.prisma.memory.create({
      data: {
        userId: currentUser.userId,
        type: dto.type,
        content: dto.content,
        importance: dto.importance ?? 5,
      },
      include: {
        user: { select: { id: true, email: true, name: true } },
      },
    });

    this.logger.log(`用户 ${currentUser.userId} 创建记忆 ${memory.id}`);
    return memory;
  }

  /** 分页查询记忆(ADMIN 可查所有,其他角色只能查自己的) */
  async findAll(query: QueryMemoryDto, currentUser: CurrentUser) {
    const { page = 1, pageSize = 20, skip, take, keyword, sort } = query;
    const where: Prisma.MemoryWhereInput = {};

    // 非 ADMIN 只能查询自己的记忆
    if (currentUser.role !== UserRole.ADMIN) {
      where.userId = currentUser.userId;
    } else if (query.userId) {
      // ADMIN 可按 userId 过滤
      where.userId = query.userId;
    }

    // 按类型过滤
    if (query.type) {
      where.type = query.type;
    }

    // 关键字模糊匹配 content
    if (keyword) {
      where.content = { contains: keyword, mode: 'insensitive' };
    }

    const orderBy = this.parseSort(sort);

    const [list, total] = await Promise.all([
      this.prisma.memory.findMany({
        where,
        skip,
        take,
        orderBy,
        include: {
          user: { select: { id: true, email: true, name: true } },
        },
      }),
      this.prisma.memory.count({ where }),
    ]);

    return PaginatedResponse.create(list, total, page, pageSize);
  }

  /** 查询记忆详情(MEMBER 只能看自己的) */
  async findOne(id: number, currentUser: CurrentUser) {
    const memory = await this.prisma.memory.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, email: true, name: true } },
      },
    });
    if (!memory) throw BizException.memoryNotFound();

    // MEMBER 只能查看自己的记忆
    if (currentUser.role === UserRole.MEMBER && memory.userId !== currentUser.userId) {
      throw BizException.forbidden('只能查看自己的记忆');
    }

    return memory;
  }

  /** 查询某用户所有记忆(供 AI 模块使用,按 importance 降序) */
  async findByUser(userId: number) {
    return this.prisma.memory.findMany({
      where: { userId },
      orderBy: { importance: 'desc' },
    });
  }

  /** 更新记忆(只能更新自己的,ADMIN 除外) */
  async update(id: number, dto: UpdateMemoryDto, currentUser: CurrentUser) {
    const memory = await this.prisma.memory.findUnique({ where: { id } });
    if (!memory) throw BizException.memoryNotFound();

    // 非 ADMIN 只能更新自己的记忆
    if (currentUser.role !== UserRole.ADMIN && memory.userId !== currentUser.userId) {
      throw BizException.forbidden('只能更新自己的记忆');
    }

    const updated = await this.prisma.memory.update({
      where: { id },
      data: {
        ...(dto.content !== undefined && { content: dto.content }),
        ...(dto.importance !== undefined && { importance: dto.importance }),
      },
      include: {
        user: { select: { id: true, email: true, name: true } },
      },
    });

    this.logger.log(`用户 ${currentUser.userId} 更新记忆 ${id}`);
    return updated;
  }

  /** 删除记忆(只能删自己的,ADMIN 除外) */
  async remove(id: number, currentUser: CurrentUser) {
    const memory = await this.prisma.memory.findUnique({ where: { id } });
    if (!memory) throw BizException.memoryNotFound();

    // 非 ADMIN 只能删除自己的记忆
    if (currentUser.role !== UserRole.ADMIN && memory.userId !== currentUser.userId) {
      throw BizException.forbidden('只能删除自己的记忆');
    }

    await this.prisma.memory.delete({ where: { id } });
    this.logger.log(`用户 ${currentUser.userId} 删除记忆 ${id}`);
    return { success: true };
  }
}
