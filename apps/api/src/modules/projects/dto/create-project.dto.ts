import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Length } from 'class-validator';

export class CreateProjectDto {
  @ApiProperty({ example: '数据看板重构', description: '项目名称', minLength: 1, maxLength: 100 })
  @IsString()
  @Length(1, 100)
  name: string;

  @ApiPropertyOptional({ example: '项目描述信息', description: '项目描述' })
  @IsString()
  @IsOptional()
  description?: string;
}
