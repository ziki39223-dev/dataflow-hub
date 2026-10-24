import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ParseIntPipe } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUserDecorator } from 'src/common/decorators/current-user.decorator';
import { CurrentUser } from 'src/common/types/jwt-payload.interface';
import { CreateMemoryDto } from './dto/create-memory.dto';
import { UpdateMemoryDto } from './dto/update-memory.dto';
import { QueryMemoryDto } from './dto/query-memory.dto';
import { MemoryService } from './memory.service';

@ApiTags('memory')
@ApiBearerAuth('access-token')
@Controller('memory')
export class MemoryController {
  constructor(private readonly memoryService: MemoryService) {}

  @Post()
  @ApiOperation({ summary: '创建记忆' })
  create(@Body() dto: CreateMemoryDto, @CurrentUserDecorator() currentUser: CurrentUser) {
    return this.memoryService.create(dto, currentUser);
  }

  @Get()
  @ApiOperation({ summary: '记忆列表(支持过滤分页)' })
  findAll(@Query() query: QueryMemoryDto, @CurrentUserDecorator() currentUser: CurrentUser) {
    return this.memoryService.findAll(query, currentUser);
  }

  @Get(':id')
  @ApiOperation({ summary: '记忆详情' })
  findOne(@Param('id', ParseIntPipe) id: number, @CurrentUserDecorator() currentUser: CurrentUser) {
    return this.memoryService.findOne(id, currentUser);
  }

  @Patch(':id')
  @ApiOperation({ summary: '更新记忆' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateMemoryDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return this.memoryService.update(id, dto, currentUser);
  }

  @Delete(':id')
  @ApiOperation({ summary: '删除记忆' })
  remove(@Param('id', ParseIntPipe) id: number, @CurrentUserDecorator() currentUser: CurrentUser) {
    return this.memoryService.remove(id, currentUser);
  }
}
