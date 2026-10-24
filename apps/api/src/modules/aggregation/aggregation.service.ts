import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { RabbitmqService } from '../rabbitmq/rabbitmq.service';
import { Report } from '@prisma/client';

export interface DailyAggregationResult {
  date: Date;
  totalUsers: number;
  totalReports: number;
  reports: Array<{
    userId: number;
    taskTotal: number;
    taskDone: number;
    completionRate: number;
    diaryCount: number;
  }>;
}

/**
 * 数据聚合服务
 * 每天 23:00 由 Scheduler 触发,统计当天任务与日报,生成 Report
 */
@Injectable()
export class AggregationService {
  private readonly logger = new Logger(AggregationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly rabbitmqService: RabbitmqService,
  ) {}

  /**
   * 聚合某天的数据并生成日报
   * @param date 目标日期(默认今天)
   * @param targetUserId 指定用户(可选,用于手动触发单个用户)
   */
  async aggregateDaily(date: Date = new Date(), targetUserId?: number): Promise<DailyAggregationResult> {
    const dayStart = this.startOfDay(date);
    const dayEnd = this.endOfDay(date);

    // 查询目标用户列表
    const users = await this.prisma.user.findMany({
      where: {
        isActive: true,
        ...(targetUserId ? { id: targetUserId } : {}),
      },
      select: { id: true, email: true, name: true },
    });

    const reports: DailyAggregationResult['reports'] = [];

    for (const user of users) {
      // 统计当天创建的任务(以创建时间为准)
      const tasks = await this.prisma.task.findMany({
        where: {
          creatorId: user.id,
          createdAt: { gte: dayStart, lte: dayEnd },
        },
        select: { id: true, status: true },
      });
      const taskTotal = tasks.length;
      const taskDone = tasks.filter((t) => t.status === 'DONE').length;
      const completionRate = taskTotal === 0 ? 0 : Number(((taskDone / taskTotal) * 100).toFixed(2));

      // 统计当天日报数量
      const diaryCount = await this.prisma.diary.count({
        where: {
          userId: user.id,
          date: { gte: dayStart, lte: dayEnd },
        },
      });

      // 读取当天日报内容(拼接成报告内容)
      const diaries = await this.prisma.diary.findMany({
        where: {
          userId: user.id,
          date: { gte: dayStart, lte: dayEnd },
        },
        select: { summary: true, content: true },
        orderBy: { createdAt: 'asc' },
      });
      const content = this.buildReportContent(user, diaries, {
        taskTotal,
        taskDone,
        completionRate,
        diaryCount,
      });

      // 创建/更新当天 Report(同用户同日期唯一)
      const report = await this.prisma.report.upsert({
        where: {
          userId_date: { userId: user.id, date: dayStart },
        },
        update: {
          content,
          taskTotal,
          taskDone,
          diaryCount,
        },
        create: {
          userId: user.id,
          date: dayStart,
          content,
          taskTotal,
          taskDone,
          diaryCount,
        },
      });

      reports.push({
        userId: user.id,
        taskTotal,
        taskDone,
        completionRate,
        diaryCount,
      });

      // 发送 RabbitMQ 通知:报告已生成
      await this.rabbitmqService.publishTaskEvent({
        type: 'REPORT_GENERATED',
        userId: user.id,
        reportId: report.id,
        date: dayStart.toISOString(),
      });
    }

    this.logger.log(
      `聚合完成 ${dayStart.toISOString().slice(0, 10)}: 用户 ${users.length} 人, 报告 ${reports.length} 份`,
    );

    return {
      date: dayStart,
      totalUsers: users.length,
      totalReports: reports.length,
      reports,
    };
  }

  /** 查询某用户某天的报告 */
  async getUserReport(userId: number, date: Date): Promise<Report | null> {
    const dayStart = this.startOfDay(date);
    return this.prisma.report.findUnique({
      where: { userId_date: { userId, date: dayStart } },
    });
  }

  /** 查询用户报告列表(分页) */
  async listUserReports(userId: number, page = 1, pageSize = 20) {
    const skip = (page - 1) * pageSize;
    const [list, total] = await Promise.all([
      this.prisma.report.findMany({
        where: { userId },
        skip,
        take: pageSize,
        orderBy: { date: 'desc' },
      }),
      this.prisma.report.count({ where: { userId } }),
    ]);
    return { list, total, page, pageSize, totalPages: Math.ceil(total / pageSize) || 0 };
  }

  /** 根据 id 查询报告 */
  async findReportById(id: number): Promise<Report | null> {
    return this.prisma.report.findUnique({ where: { id } });
  }

  private buildReportContent(
    user: { id: number; email: string; name: string | null },
    diaries: { summary: string | null; content: string }[],
    stats: { taskTotal: number; taskDone: number; completionRate: number; diaryCount: number },
  ): string {
    const lines: string[] = [];
    lines.push(`# 日报 - ${user.name || user.email}`);
    lines.push('');
    lines.push('## 任务统计');
    lines.push(`- 任务总数: ${stats.taskTotal}`);
    lines.push(`- 已完成: ${stats.taskDone}`);
    lines.push(`- 完成率: ${stats.completionRate}%`);
    lines.push('');
    lines.push('## 工作日志');
    if (diaries.length === 0) {
      lines.push('暂无日志');
    } else {
      diaries.forEach((d, i) => {
        lines.push(`${i + 1}. ${d.summary || d.content.slice(0, 80)}`);
      });
    }
    return lines.join('\n');
  }

  private startOfDay(date: Date): Date {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  private endOfDay(date: Date): Date {
    const d = new Date(date);
    d.setHours(23, 59, 59, 999);
    return d;
  }
}
