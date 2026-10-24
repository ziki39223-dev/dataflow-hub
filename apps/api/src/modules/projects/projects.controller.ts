import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ParseIntPipe } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUserDecorator } from 'src/common/decorators/current-user.decorator';
import { PaginationDto } from 'src/common/dto/pagination.dto';
import { CurrentUser } from 'src/common/types/jwt-payload.interface';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { ProjectsService } from './projects.service';

@ApiTags('projects')
@ApiBearerAuth('access-token')
@Controller('projects')
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Post()
  @ApiOperation({ summary: '创建项目' })
  create(@Body() dto: CreateProjectDto, @CurrentUserDecorator() currentUser: CurrentUser) {
    return this.projectsService.create(dto, currentUser);
  }

  @Get()
  @ApiOperation({ summary: '项目列表(当前用户作为 owner 或同公司)' })
  findAll(@Query() query: PaginationDto, @CurrentUserDecorator() currentUser: CurrentUser) {
    return this.projectsService.findAll(query, currentUser);
  }

  @Get(':id')
  @ApiOperation({ summary: '项目详情' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.projectsService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: '更新项目(仅 owner 或管理员)' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateProjectDto,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return this.projectsService.update(id, dto, currentUser);
  }

  @Delete(':id')
  @ApiOperation({ summary: '删除项目(仅 owner 或管理员)' })
  remove(@Param('id', ParseIntPipe) id: number, @CurrentUserDecorator() currentUser: CurrentUser) {
    return this.projectsService.remove(id, currentUser);
  }
}
