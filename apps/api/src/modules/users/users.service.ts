import { Injectable } from '@nestjs/common';
import { Prisma, UserRole } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { BizException } from 'src/common/exceptions/business.exception';
import { CurrentUser } from 'src/common/types/jwt-payload.interface';
import { PaginationDto } from 'src/common/dto/pagination.dto';
import { PaginatedResponse } from 'src/common/utils/api-response';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  /** 查询用户时排除 password 字段 */
  private readonly userSelect = Prisma.validator<Prisma.UserSelect>()({
    id: true,
    email: true,
    name: true,
    role: true,
    companyId: true,
    isActive: true,
    createdAt: true,
    updatedAt: true,
  });

  /** 解析排序参数,格式如 "createdAt:desc" */
  private parseSort(sort?: string): Prisma.UserOrderByWithRelationInput {
    if (!sort) return { createdAt: 'desc' };
    const [field, direction] = sort.split(':');
    if (!field) return { createdAt: 'desc' };
    return { [field]: direction === 'desc' ? 'desc' : 'asc' };
  }

  /** 分页查询用户 */
  async findAll(query: PaginationDto, currentUser: CurrentUser) {
    const { page = 1, pageSize = 20, skip, take, keyword, sort } = query;
    const where: Prisma.UserWhereInput = {};

    // 非 ADMIN 只能查看同公司用户
    if (currentUser.role !== UserRole.ADMIN) {
      where.companyId = currentUser.companyId ?? null;
    }

    // 关键字搜索 email/name
    if (keyword) {
      where.OR = [
        { email: { contains: keyword, mode: 'insensitive' } },
        { name: { contains: keyword, mode: 'insensitive' } },
      ];
    }

    const orderBy = this.parseSort(sort);

    const [list, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: this.userSelect,
        skip,
        take,
        orderBy,
      }),
      this.prisma.user.count({ where }),
    ]);

    return PaginatedResponse.create(list, total, page, pageSize);
  }

  /** 查询单个用户(排除 password) */
  async findOne(id: number) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: this.userSelect,
    });
    if (!user) throw BizException.userNotFound();
    return user;
  }

  /** 更新用户 */
  async update(id: number, dto: UpdateUserDto, currentUser: CurrentUser) {
    // 确认用户存在
    const existing = await this.prisma.user.findUnique({ where: { id } });
    if (!existing) throw BizException.userNotFound();

    const isAdmin = currentUser.role === UserRole.ADMIN;

    // 非 ADMIN 不能修改 role 和 isActive
    if (!isAdmin) {
      if (dto.role !== undefined || dto.isActive !== undefined) {
        throw BizException.roleForbidden('只有管理员可修改角色或启用状态');
      }
      // 普通用户只能修改自己的 name
      if (id !== currentUser.userId) {
        throw BizException.roleForbidden('只能修改自己的信息');
      }
    }

    const updated = await this.prisma.user.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.role !== undefined && { role: dto.role }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
      select: this.userSelect,
    });

    return updated;
  }

  /** 删除用户(软删除:设 isActive=false) */
  async remove(id: number, currentUser: CurrentUser) {
    // 不能删除自己
    if (id === currentUser.userId) {
      throw BizException.badRequest('不能删除自己');
    }

    // 确认用户存在
    const existing = await this.prisma.user.findUnique({ where: { id } });
    if (!existing) throw BizException.userNotFound();

    // 软删除
    await this.prisma.user.update({
      where: { id },
      data: { isActive: false },
    });

    return { success: true };
  }
}
