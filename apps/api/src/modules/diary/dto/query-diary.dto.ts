import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsInt, IsOptional } from 'class-validator';
import { PaginationDto } from 'src/common/dto/pagination.dto';

export class QueryDiaryDto extends PaginationDto {
  @ApiPropertyOptional({ description: '用户 ID 过滤' })
  @IsInt()
  @IsOptional()
  userId?: number;

  @ApiPropertyOptional({ example: '2025-12-01', description: '起始日期(ISO8601)' })
  @IsDateString()
  @IsOptional()
  startDate?: string;

  @ApiPropertyOptional({ example: '2025-12-31', description: '结束日期(ISO8601)' })
  @IsDateString()
  @IsOptional()
  endDate?: string;
}
