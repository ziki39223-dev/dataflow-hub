import { Injectable, Logger } from '@nestjs/common';
import { Prisma, TaskStatus } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { RabbitmqService } from 'src/modules/rabbitmq/rabbitmq.service';
import { BizException } from 'src/common/exceptions/business.exception';
import { CurrentUser } from 'src/common/types/jwt-payload.interface';
import { PaginatedResponse } from 'src/common/utils/api-response';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { QueryTaskDto } from './dto/query-task.dto';

/** 合法的任务状态流转映射 */
const VALID_TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  [TaskStatus.TODO]: [TaskStatus.DOING, TaskStatus.FAILED],
  [TaskStatus.DOING]: [TaskStatus.DONE, TaskStatus.FAILED],
  [TaskStatus.DONE]: [TaskStatus.FAILED],
  [TaskStatus.FAILED]: [TaskStatus.TODO, TaskStatus.DOING],
};

@Injectable()
export class TasksService {
  private readonly logger = new Logger(TasksService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly rabbitmqService: RabbitmqService,
  ) {}

  /** 解析排序参数,格式如 "createdAt:desc" */
  private parseSort(sort?: string): Prisma.TaskOrderByWithRelationInput {
    if (!sort) return { createdAt: 'desc' };
    const [field, direction] = sort.split(':');
    if (!field) return { createdAt: 'desc' };
    return { [field]: direction === 'desc' ? 'desc' : 'asc' };
  }

  /** 校验状态流转是否合法 */
  private validateTransition(from: TaskStatus, to: TaskStatus): void {
    // 允许 FAILED 从任意状态转入
    if (to === TaskStatus.FAILED) return;
    // 相同状态允许
    if (from === to) return;
    const allowed = VALID_TRANSITIONS[from] ?? [];
    if (!allowed.includes(to)) {
      throw BizException.taskStatusInvalid();
    }
  }

  /** 创建任务 */
  async create(dto: CreateTaskDto, currentUser: CurrentUser) {
    // 校验项目存在
    const project = await this.prisma.project.findUnique({ where: { id: dto.projectId } });
    if (!project) throw BizException.projectNotFound();

    const task = await this.prisma.task.create({
      data: {
        projectId: dto.projectId,
        title: dto.title,
        description: dto.description,
        priority: dto.priority ?? undefined,
        deadline: dto.deadline ? new Date(dto.deadline) : undefined,
        creatorId: currentUser.userId,
        assigneeId: dto.assigneeId,
      },
      include: {
        project: { select: { id: true, name: true } },
        creator: { select: { id: true, email: true, name: true } },
        assignee: { select: { id: true, email: true, name: true } },
      },
    });

    this.logger.log(`用户 ${currentUser.userId} 创建任务 ${task.id}`);
    return task;
  }

  /** 分页查询任务(支持按 projectId/status/priority/assigneeId/keyword 过滤) */
  async findAll(query: QueryTaskDto) {
    const { page = 1, pageSize = 20, skip, take, keyword, sort } = query;
    const where: Prisma.TaskWhereInput = {};

    if (query.projectId) where.projectId = query.projectId;
    if (query.status) where.status = query.status;
    if (query.priority) where.priority = query.priority;
    if (query.assigneeId) where.assigneeId = query.assigneeId;

    // 关键字模糊匹配 title
    if (keyword) {
      where.title = { contains: keyword, mode: 'insensitive' };
    }

    const orderBy = this.parseSort(sort);

    const [list, total] = await Promise.all([
      this.prisma.task.findMany({
        where,
        skip,
        take,
        orderBy,
        include: {
          project: { select: { id: true, name: true } },
          creator: { select: { id: true, email: true, name: true } },
          assignee: { select: { id: true, email: true, name: true } },
        },
      }),
      this.prisma.task.count({ where }),
    ]);

    return PaginatedResponse.create(list, total, page, pageSize);
  }

  /** 查询任务详情 */
  async findOne(id: number) {
    const task = await this.prisma.task.findUnique({
      where: { id },
      include: {
        project: { select: { id: true, name: true } },
        creator: { select: { id: true, email: true, name: true } },
        assignee: { select: { id: true, email: true, name: true } },
      },
    });
    if (!task) throw BizException.taskNotFound();
    return task;
  }

  /** 更新任务 */
  async update(id: number, dto: UpdateTaskDto, currentUser: CurrentUser) {
    const task = await this.prisma.task.findUnique({ where: { id } });
    if (!task) throw BizException.taskNotFound();

    // 状态流转校验
    if (dto.status && dto.status !== task.status) {
      this.validateTransition(task.status, dto.status);
    }

    const updated = await this.prisma.task.update({
      where: { id },
      data: {
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.priority !== undefined && { priority: dto.priority }),
        ...(dto.status !== undefined && { status: dto.status }),
        ...(dto.deadline !== undefined && { deadline: new Date(dto.deadline) }),
        ...(dto.assigneeId !== undefined && { assigneeId: dto.assigneeId }),
        ...(dto.projectId !== undefined && { projectId: dto.projectId }),
      },
      include: {
        project: { select: { id: true, name: true } },
        creator: { select: { id: true, email: true, name: true } },
        assignee: { select: { id: true, email: true, name: true } },
      },
    });

    // 任务变为 DONE 时发布 RabbitMQ 事件
    if (dto.status === TaskStatus.DONE && task.status !== TaskStatus.DONE) {
      await this.rabbitmqService.publishTaskEvent({
        type: 'TASK_DONE',
        userId: currentUser.userId,
        taskId: id,
        projectId: task.projectId,
      });
      this.logger.log(`任务 ${id} 已完成,触发 TASK_DONE 事件`);
    }

    return updated;
  }

  /** 删除任务 */
  async remove(id: number, currentUser: CurrentUser) {
    const task = await this.prisma.task.findUnique({ where: { id } });
    if (!task) throw BizException.taskNotFound();

    await this.prisma.task.delete({ where: { id } });
    this.logger.log(`用户 ${currentUser.userId} 删除任务 ${id}`);
    return { success: true };
  }
}
