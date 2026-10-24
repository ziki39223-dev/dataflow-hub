import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString, Length } from 'class-validator';

export class CreateDiaryDto {
  @ApiProperty({ example: '今天完成了任务模块的开发,并修复了若干 bug。', description: '日志内容', minLength: 1, maxLength: 5000 })
  @IsString()
  @Length(1, 5000)
  content: string;

  @ApiPropertyOptional({ example: '完成任务模块开发', description: '日志摘要' })
  @IsString()
  @IsOptional()
  summary?: string;

  @ApiPropertyOptional({ example: '2025-12-31', description: '日志日期(ISO8601),默认今天' })
  @IsDateString()
  @IsOptional()
  date?: string;
}
