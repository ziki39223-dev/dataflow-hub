import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Prisma, NotificationType } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { RabbitmqService } from 'src/modules/rabbitmq/rabbitmq.service';
import { BizException } from 'src/common/exceptions/business.exception';
import { CurrentUser } from 'src/common/types/jwt-payload.interface';
import { PaginatedResponse } from 'src/common/utils/api-response';
import { QueryNotificationDto } from './dto/query-notification.dto';

/** 任务事件类型到通知类型/标题/内容的映射配置 */
interface EventMapping {
  type: NotificationType;
  title: string;
  buildContent: (msg: any) => string;
}

const EVENT_MAPPINGS: Record<string, EventMapping> = {
  TASK_DONE: {
    type: NotificationType.TASK_DONE,
    title: '任务完成',
    buildContent: (msg) => `任务 #${msg.taskId} 已完成`,
  },
  TASK_ASSIGNED: {
    type: NotificationType.TASK_ASSIGNED,
    title: '任务指派',
    buildContent: (msg) => `任务 #${msg.taskId} 已指派给你`,
  },
  REPORT_GENERATED: {
    type: NotificationType.REPORT_GENERATED,
    title: '报告生成',
    buildContent: (msg) => `报告 #${msg.reportId ?? msg.taskId} 已生成`,
  },
};

@Injectable()
export class NotificationService implements OnModuleInit {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly rabbitmqService: RabbitmqService,
  ) {}

  /** 模块初始化时订阅任务事件 */
  async onModuleInit(): Promise<void> {
    try {
      await this.rabbitmqService.consumeTaskEvents(
        'dataflow.notification.queue',
        this.handleTaskEvent.bind(this),
      );
      this.logger.log('通知模块已订阅任务事件');
    } catch (err: any) {
      this.logger.error(`订阅任务事件失败: ${err.message}`);
    }
  }

  /** 处理 RabbitMQ 任务事件,根据事件类型创建通知 */
  private async handleTaskEvent(msg: any): Promise<void> {
    try {
      if (!msg || !msg.type || !msg.userId) {
        this.logger.warn('收到无效的任务事件消息,缺少 type 或 userId');
        return;
      }

      const mapping = EVENT_MAPPINGS[msg.type];
      if (!mapping) {
        // 未知事件类型归为系统通知
        await this.create(
          msg.userId,
          NotificationType.SYSTEM,
          '系统通知',
          `收到事件: ${msg.type}`,
          msg,
        );
        return;
      }

      await this.create(
        msg.userId,
        mapping.type,
        mapping.title,
        mapping.buildContent(msg),
        msg,
      );
    } catch (err: any) {
      // 捕获错误,避免消费失败导致进程崩溃
      console.error(`处理任务事件失败: ${err.message}`, err);
    }
  }

  /** 创建通知记录 */
  async create(
    userId: number,
    type: NotificationType,
    title: string,
    content: string,
    metadata?: any,
  ) {
    const notification = await this.prisma.notification.create({
      data: {
        userId,
        type,
        title,
        content,
        metadata: metadata ?? undefined,
      },
      include: {
        user: { select: { id: true, email: true, name: true } },
      },
    });

    this.logger.log(`为用户 ${userId} 创建通知 ${notification.id} (类型: ${type})`);
    return notification;
  }

  /** 解析排序参数,格式如 "createdAt:desc" */
  private parseSort(sort?: string): Prisma.NotificationOrderByWithRelationInput {
    if (!sort) return { createdAt: 'desc' };
    const [field, direction] = sort.split(':');
    if (!field) return { createdAt: 'desc' };
    return { [field]: direction === 'desc' ? 'desc' : 'asc' };
  }

  /** 分页查询当前用户的通知 */
  async findAll(query: QueryNotificationDto, currentUser: CurrentUser) {
    const { page = 1, pageSize = 20, skip, take, keyword, sort } = query;
    const where: Prisma.NotificationWhereInput = {
      userId: currentUser.userId,
    };

    // 按是否已读过滤
    if (query.isRead !== undefined) {
      where.isRead = query.isRead;
    }

    // 关键字模糊匹配 title/content
    if (keyword) {
      where.OR = [
        { title: { contains: keyword, mode: 'insensitive' } },
        { content: { contains: keyword, mode: 'insensitive' } },
      ];
    }

    const orderBy = this.parseSort(sort);

    const [list, total] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        skip,
        take,
        orderBy,
        include: {
          user: { select: { id: true, email: true, name: true } },
        },
      }),
      this.prisma.notification.count({ where }),
    ]);

    return PaginatedResponse.create(list, total, page, pageSize);
  }

  /** 查询当前用户未读通知数 */
  async findUnreadCount(currentUser: CurrentUser) {
    const count = await this.prisma.notification.count({
      where: {
        userId: currentUser.userId,
        isRead: false,
      },
    });
    return { count };
  }

  /** 标记单条通知为已读(只能操作自己的) */
  async markAsRead(id: number, currentUser: CurrentUser) {
    const notification = await this.prisma.notification.findUnique({ where: { id } });
    if (!notification) throw BizException.notFound('通知不存在');

    if (notification.userId !== currentUser.userId) {
      throw BizException.forbidden('只能操作自己的通知');
    }

    await this.prisma.notification.update({
      where: { id },
      data: { isRead: true },
    });

    return { success: true };
  }

  /** 标记当前用户所有未读通知为已读 */
  async markAllAsRead(currentUser: CurrentUser) {
    const result = await this.prisma.notification.updateMany({
      where: {
        userId: currentUser.userId,
        isRead: false,
      },
      data: { isRead: true },
    });

    return { success: true, count: result.count };
  }
}
