import { Module } from '@nestjs/common';

// 基础设施
import { ConfigModule } from './config/config.module';
import { PrismaModule } from './prisma/prisma.module';
import { CommonModule } from './common/common.module';
import { LoggerModule } from './common/logger/logger.module';
import { RedisModule } from './modules/redis/redis.module';
import { RabbitmqModule } from './modules/rabbitmq/rabbitmq.module';
import { AuthModule } from './modules/auth/auth.module';

// 业务模块
import { HealthModule } from './modules/health/health.module';
import { UsersModule } from './modules/users/users.module';
import { ProjectsModule } from './modules/projects/projects.module';
import { TasksModule } from './modules/tasks/tasks.module';
import { DiaryModule } from './modules/diary/diary.module';
import { MemoryModule } from './modules/memory/memory.module';
import { AggregationModule } from './modules/aggregation/aggregation.module';
import { SchedulerModule } from './modules/scheduler/scheduler.module';
import { AiModule } from './modules/ai/ai.module';
import { NotificationModule } from './modules/notification/notification.module';

@Module({
  imports: [
    // ===== 基础设施 =====
    ConfigModule,
    LoggerModule,
    PrismaModule,
    CommonModule,
    RedisModule,
    RabbitmqModule,
    AuthModule,

    // ===== 业务模块 =====
    HealthModule,
    UsersModule,
    ProjectsModule,
    TasksModule,
    DiaryModule,
    MemoryModule,
    AggregationModule,
    NotificationModule,
    SchedulerModule,
    AiModule,
  ],
})
export class AppModule {}
