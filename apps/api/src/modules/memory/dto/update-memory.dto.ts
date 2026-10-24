import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Length, Max, Min } from 'class-validator';

export class UpdateMemoryDto {
  @ApiPropertyOptional({ example: '更新后的记忆内容', description: '记忆内容', minLength: 1, maxLength: 2000 })
  @IsString()
  @Length(1, 2000)
  @IsOptional()
  content?: string;

  @ApiPropertyOptional({ example: 8, minimum: 1, maximum: 10, description: '重要程度(1-10)' })
  @IsInt()
  @Min(1)
  @Max(10)
  @IsOptional()
  importance?: number;
}
