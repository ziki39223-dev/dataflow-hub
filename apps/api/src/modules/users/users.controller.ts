import { Body, Controller, Delete, Get, Param, Patch, Query } from '@nestjs/common';
import { ParseIntPipe } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { CurrentUserDecorator } from 'src/common/decorators/current-user.decorator';
import { Roles } from 'src/common/decorators/roles.decorator';
import { PaginationDto } from 'src/common/dto/pagination.dto';
import { CurrentUser } from 'src/common/types/jwt-payload.interface';
import { UpdateUserDto } from './dto/update-user.dto';
import { UsersService } from './users.service';

@ApiTags('users')
@ApiBearerAuth('access-token')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @ApiOperation({ summary: '用户列表(管理员可查所有,其他仅同公司)' })
  findAll(@Query() query: PaginationDto, @CurrentUserDecorator() currentUser: CurrentUser) {
    return this.usersService.findAll(query, currentUser);
  }

  @Get(':id')
  @ApiOperation({ summary: '用户详情' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: '更新用户(管理员可改角色/状态,普通用户仅改自己昵称)' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateUserDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return this.usersService.update(id, dto, currentUser);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: '删除用户(软删除,仅管理员)' })
  remove(@Param('id', ParseIntPipe) id: number, @CurrentUserDecorator() currentUser: CurrentUser) {
    return this.usersService.remove(id, currentUser);
  }
}
