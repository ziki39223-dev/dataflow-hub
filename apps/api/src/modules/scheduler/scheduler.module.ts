import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { AggregationModule } from '../aggregation/aggregation.module';
import { SchedulerService } from './scheduler.service';

@Module({
  imports: [ScheduleModule.forRoot(), AggregationModule],
  providers: [SchedulerService],
})
export class SchedulerModule {}
