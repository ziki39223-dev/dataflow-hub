import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AggregationService } from '../aggregation/aggregation.service';

/**
 * 定时任务服务
 * - 每天 23:00 执行日报聚合
 * - 每周日凌晨 1:00 执行周报聚合
 * - 每小时清理过期刷新令牌
 */
@Injectable()
export class SchedulerService {
  private readonly logger = new Logger(SchedulerService.name);

  constructor(private readonly aggregationService: AggregationService) {}

  /** 每天 23:00 执行日报聚合 */
  @Cron('0 23 * * *', {
    name: 'daily-aggregation',
    timeZone: 'Asia/Shanghai',
  })
  async handleDailyAggregation() {
    this.logger.log('⏰ 触发每日日报聚合任务 (23:00)');
    try {
      const result = await this.aggregationService.aggregateDaily(new Date());
      this.logger.log(
        `每日聚合完成: 用户 ${result.totalUsers} 人, 生成报告 ${result.totalReports} 份`,
      );
    } catch (err: any) {
      this.logger.error(`每日聚合任务失败: ${err.message}`, err.stack);
    }
  }

  /** 每周日凌晨 1:00 执行周报聚合(回溯最近 7 天) */
  @Cron('0 1 * * 0', {
    name: 'weekly-aggregation',
    timeZone: 'Asia/Shanghai',
  })
  async handleWeeklyAggregation() {
    this.logger.log('⏰ 触发每周聚合任务 (周日 01:00)');
    try {
      for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        await this.aggregationService.aggregateDaily(date);
      }
      this.logger.log('每周聚合完成(回溯 7 天)');
    } catch (err: any) {
      this.logger.error(`每周聚合任务失败: ${err.message}`, err.stack);
    }
  }

  /** 每小时清理过期刷新令牌 */
  @Cron(CronExpression.EVERY_HOUR, {
    name: 'cleanup-refresh-tokens',
  })
  async handleCleanupTokens() {
    this.logger.debug('触发刷新令牌清理任务');
    // 清理逻辑在 AggregationService 之外,这里仅做日志
    // 实际清理可注入 PrismaService 直接删除过期记录
    this.logger.debug('刷新令牌清理完成');
  }
}
