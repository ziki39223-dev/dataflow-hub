import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TaskPriority } from '@prisma/client';
import { IsDateString, IsEnum, IsInt, IsOptional, IsString, Length } from 'class-validator';

export class CreateTaskDto {
  @ApiProperty({ example: 1, description: '所属项目 ID' })
  @IsInt()
  projectId: number;

  @ApiProperty({ example: '完成需求文档', description: '任务标题', minLength: 1, maxLength: 200 })
  @IsString()
  @Length(1, 200)
  title: string;

  @ApiPropertyOptional({ example: '详细的任务描述', description: '任务描述' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({
    enum: TaskPriority,
    default: TaskPriority.MEDIUM,
    description: '任务优先级',
  })
  @IsEnum(TaskPriority)
  @IsOptional()
  priority?: TaskPriority = TaskPriority.MEDIUM;

  @ApiPropertyOptional({ example: '2025-12-31T23:59:59.000Z', description: '截止时间(ISO8601)' })
  @IsDateString()
  @IsOptional()
  deadline?: string;

  @ApiPropertyOptional({ example: 2, description: '指派人 ID' })
  @IsInt()
  @IsOptional()
  assigneeId?: number;
}
