import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ParseIntPipe } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUserDecorator } from 'src/common/decorators/current-user.decorator';
import { CurrentUser } from 'src/common/types/jwt-payload.interface';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { QueryTaskDto } from './dto/query-task.dto';
import { TasksService } from './tasks.service';

@ApiTags('tasks')
@ApiBearerAuth('access-token')
@Controller('tasks')
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Post()
  @ApiOperation({ summary: '创建任务' })
  create(@Body() dto: CreateTaskDto, @CurrentUserDecorator() currentUser: CurrentUser) {
    return this.tasksService.create(dto, currentUser);
  }

  @Get()
  @ApiOperation({ summary: '任务列表(支持过滤分页)' })
  findAll(@Query() query: QueryTaskDto) {
    return this.tasksService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: '任务详情' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.tasksService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: '更新任务' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateTaskDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return this.tasksService.update(id, dto, currentUser);
  }

  @Delete(':id')
  @ApiOperation({ summary: '删除任务' })
  remove(@Param('id', ParseIntPipe) id: number, @CurrentUserDecorator() currentUser: CurrentUser) {
    return this.tasksService.remove(id, currentUser);
  }
}
