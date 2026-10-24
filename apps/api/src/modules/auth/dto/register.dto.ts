import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, Length } from 'class-validator';

export class RegisterDto {
  @ApiProperty({ example: 'test@test.com', description: '邮箱' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: '123456', description: '密码 (6-32 位)', minLength: 6, maxLength: 32 })
  @IsString()
  @Length(6, 32)
  password: string;

  @ApiPropertyOptional({ example: 'demo', description: '公司名称(注册时自动创建/关联公司)' })
  @IsString()
  @IsOptional()
  company?: string;

  @ApiPropertyOptional({ example: '张三', description: '昵称' })
  @IsString()
  @IsOptional()
  name?: string;
}

export class LoginDto {
  @ApiProperty({ example: 'test@test.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: '123456' })
  @IsString()
  @Length(1, 64)
  password: string;
}

export class RefreshTokenDto {
  @ApiProperty({ description: '刷新令牌' })
  @IsString()
  refreshToken: string;
}
