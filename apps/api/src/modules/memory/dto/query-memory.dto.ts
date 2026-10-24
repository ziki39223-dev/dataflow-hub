import { ApiPropertyOptional } from '@nestjs/swagger';
import { MemoryType } from '@prisma/client';
import { IsEnum, IsInt, IsOptional } from 'class-validator';
import { PaginationDto } from 'src/common/dto/pagination.dto';

export class QueryMemoryDto extends PaginationDto {
  @ApiPropertyOptional({ enum: MemoryType, description: '记忆类型过滤' })
  @IsEnum(MemoryType)
  @IsOptional()
  type?: MemoryType;

  @ApiPropertyOptional({ description: '用户 ID 过滤(仅 ADMIN 可用)' })
  @IsInt()
  @IsOptional()
  userId?: number;
}
