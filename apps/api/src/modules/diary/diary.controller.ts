import { Body, Controller, Delete, Get, Param, Post, Query } from '@nestjs/common';
import { ParseIntPipe } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUserDecorator } from 'src/common/decorators/current-user.decorator';
import { CurrentUser } from 'src/common/types/jwt-payload.interface';
import { CreateDiaryDto } from './dto/create-diary.dto';
import { QueryDiaryDto } from './dto/query-diary.dto';
import { DiaryService } from './diary.service';

@ApiTags('diary')
@ApiBearerAuth('access-token')
@Controller('diary')
export class DiaryController {
  constructor(private readonly diaryService: DiaryService) {}

  @Post()
  @ApiOperation({ summary: '创建日志' })
  create(@Body() dto: CreateDiaryDto, @CurrentUserDecorator() currentUser: CurrentUser) {
    return this.diaryService.create(dto, currentUser);
  }

  @Get()
  @ApiOperation({ summary: '日志列表(支持过滤分页)' })
  findAll(@Query() query: QueryDiaryDto, @CurrentUserDecorator() currentUser: CurrentUser) {
    return this.diaryService.findAll(query, currentUser);
  }

  @Get(':id')
  @ApiOperation({ summary: '日志详情' })
  findOne(@Param('id', ParseIntPipe) id: number, @CurrentUserDecorator() currentUser: CurrentUser) {
    return this.diaryService.findOne(id, currentUser);
  }

  @Delete(':id')
  @ApiOperation({ summary: '删除日志' })
  remove(@Param('id', ParseIntPipe) id: number, @CurrentUserDecorator() currentUser: CurrentUser) {
    return this.diaryService.remove(id, currentUser);
  }
}
