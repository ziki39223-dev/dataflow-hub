import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Length } from 'class-validator';

export class UpdateProjectDto {
  @ApiPropertyOptional({ example: '数据看板重构', description: '项目名称', minLength: 1, maxLength: 100 })
  @IsString()
  @Length(1, 100)
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ example: '项目描述信息', description: '项目描述' })
  @IsString()
  @IsOptional()
  description?: string;
}
