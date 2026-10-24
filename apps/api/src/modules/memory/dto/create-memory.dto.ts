import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MemoryType } from '@prisma/client';
import { IsEnum, IsInt, IsString, Length, Max, Min } from 'class-validator';

export class CreateMemoryDto {
  @ApiProperty({
    enum: MemoryType,
    example: MemoryType.USER_PREFERENCE,
    description: '记忆类型',
  })
  @IsEnum(MemoryType)
  type: MemoryType;

  @ApiProperty({ example: '用户偏好使用深色主题', description: '记忆内容', minLength: 1, maxLength: 2000 })
  @IsString()
  @Length(1, 2000)
  content: string;

  @ApiPropertyOptional({ example: 5, minimum: 1, maximum: 10, default: 5, description: '重要程度(1-10)' })
  @IsInt()
  @Min(1)
  @Max(10)
  importance?: number = 5;
}
