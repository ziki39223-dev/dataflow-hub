import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsOptional } from 'class-validator';
import { PaginationDto } from 'src/common/dto/pagination.dto';

export class QueryNotificationDto extends PaginationDto {
  @ApiPropertyOptional({ example: false, description: '是否已读过滤' })
  @Type(() => Boolean)
  @IsBoolean()
  @IsOptional()
  isRead?: boolean;
}
