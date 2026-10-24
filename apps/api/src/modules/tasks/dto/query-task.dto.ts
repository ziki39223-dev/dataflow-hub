import { ApiPropertyOptional } from '@nestjs/swagger';
import { TaskPriority, TaskStatus } from '@prisma/client';
import { IsEnum, IsInt, IsOptional } from 'class-validator';
import { PaginationDto } from 'src/common/dto/pagination.dto';

export class QueryTaskDto extends PaginationDto {
  @ApiPropertyOptional({ description: '项目 ID 过滤' })
  @IsInt()
  @IsOptional()
  projectId?: number;

  @ApiPropertyOptional({ enum: TaskStatus, description: '任务状态过滤' })
  @IsEnum(TaskStatus)
  @IsOptional()
  status?: TaskStatus;

  @ApiPropertyOptional({ enum: TaskPriority, description: '任务优先级过滤' })
  @IsEnum(TaskPriority)
  @IsOptional()
  priority?: TaskPriority;

  @ApiPropertyOptional({ description: '指派人 ID 过滤' })
  @IsInt()
  @IsOptional()
  assigneeId?: number;
}
