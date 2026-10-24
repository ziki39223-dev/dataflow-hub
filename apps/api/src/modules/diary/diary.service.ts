import { Injectable, Logger } from '@nestjs/common';
import { Prisma, UserRole } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { BizException } from 'src/common/exceptions/business.exception';
import { CurrentUser } from 'src/common/types/jwt-payload.interface';
import { PaginatedResponse } from 'src/common/utils/api-response';
import { CreateDiaryDto } from './dto/create-diary.dto';
import { QueryDiaryDto } from './dto/query-diary.dto';

/** 自动摘要最大长度 */
const SUMMARY_MAX_LENGTH = 50;

@Injectable()
export class DiaryService {
  private readonly logger = new Logger(DiaryService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** 解析排序参数,格式如 "createdAt:desc" */
  private parseSort(sort?: string): Prisma.DiaryOrderByWithRelationInput {
    if (!sort) return { createdAt: 'desc' };
    const [field, direction] = sort.split(':');
    if (!field) return { createdAt: 'desc' };
    return { [field]: direction === 'desc' ? 'desc' : 'asc' };
  }

  /** 根据内容生成简单摘要(取前 50 字符 + '...') */
  private generateSummary(content: string): string {
    if (content.length <= SUMMARY_MAX_LENGTH) return content;
    return content.slice(0, SUMMARY_MAX_LENGTH) + '...';
  }

  /** 创建日志 */
  async create(dto: CreateDiaryDto, currentUser: CurrentUser) {
    const diary = await this.prisma.diary.create({
      data: {
        userId: currentUser.userId,
        content: dto.content,
        // 未提供 summary 时自动生成
        summary: dto.summary ?? this.generateSummary(dto.content),
        date: dto.date ? new Date(dto.date) : new Date(),
      },
      include: {
        user: { select: { id: true, email: true, name: true } },
      },
    });

    this.logger.log(`用户 ${currentUser.userId} 创建日志 ${diary.id}`);
    return diary;
  }

  /** 分页查询日志(ADMIN/MANAGER 可查所有, MEMBER 只能查自己的) */
  async findAll(query: QueryDiaryDto, currentUser: CurrentUser) {
    const { page = 1, pageSize = 20, skip, take, keyword, sort } = query;
    const where: Prisma.DiaryWhereInput = {};

    // MEMBER 只能查自己的日志
    if (currentUser.role === UserRole.MEMBER) {
      where.userId = currentUser.userId;
    } else if (query.userId) {
      // ADMIN/MANAGER 可按 userId 过滤
      where.userId = query.userId;
    }

    // 关键字模糊匹配 content
    if (keyword) {
      where.content = { contains: keyword, mode: 'insensitive' };
    }

    // 日期范围过滤
    if (query.startDate || query.endDate) {
      where.date = {};
      if (query.startDate) where.date.gte = new Date(query.startDate);
      if (query.endDate) where.date.lte = new Date(query.endDate);
    }

    const orderBy = this.parseSort(sort);

    const [list, total] = await Promise.all([
      this.prisma.diary.findMany({
        where,
        skip,
        take,
        orderBy,
        include: {
          user: { select: { id: true, email: true, name: true } },
        },
      }),
      this.prisma.diary.count({ where }),
    ]);

    return PaginatedResponse.create(list, total, page, pageSize);
  }

  /** 查询日志详情(MEMBER 只能看自己的) */
  async findOne(id: number, currentUser: CurrentUser) {
    const diary = await this.prisma.diary.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, email: true, name: true } },
      },
    });
    if (!diary) throw BizException.diaryNotFound();

    // MEMBER 只能查看自己的日志
    if (currentUser.role === UserRole.MEMBER && diary.userId !== currentUser.userId) {
      throw BizException.forbidden('只能查看自己的日志');
    }

    return diary;
  }

  /** 查询某用户某天的日志(供聚合模块使用) */
  async findByDate(date: Date, userId: number) {
    // 计算当天的起止时间
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    const end = new Date(date);
    end.setHours(23, 59, 59, 999);

    return this.prisma.diary.findMany({
      where: {
        userId,
        date: {
          gte: start,
          lte: end,
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** 删除日志(MEMBER 只能删自己的, ADMIN 可删任意) */
  async remove(id: number, currentUser: CurrentUser) {
    const diary = await this.prisma.diary.findUnique({ where: { id } });
    if (!diary) throw BizException.diaryNotFound();

    // MEMBER 只能删除自己的日志, ADMIN 可删除任意
    if (currentUser.role === UserRole.MEMBER && diary.userId !== currentUser.userId) {
      throw BizException.forbidden('只能删除自己的日志');
    }

    await this.prisma.diary.delete({ where: { id } });
    this.logger.log(`用户 ${currentUser.userId} 删除日志 ${id}`);
    return { success: true };
  }
}
