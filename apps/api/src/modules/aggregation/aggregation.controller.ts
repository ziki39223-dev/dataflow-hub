import { Controller, Get, Post, Query, BadRequestException } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiTags } from '@nestjs/swagger';
import { Roles } from 'src/common/decorators/roles.decorator';
import { CurrentUserDecorator } from 'src/common/decorators/current-user.decorator';
import { CurrentUser } from 'src/common/types/jwt-payload.interface';
import { UserRole } from '@prisma/client';
import { AggregationService } from './aggregation.service';

class DailyReportQueryDto {
  @ApiProperty({ required: false, description: '日期 YYYY-MM-DD,默认今天' })
  date?: string;
}

@ApiTags('aggregation')
@ApiBearerAuth('access-token')
@Controller('aggregation')
export class AggregationController {
  constructor(private readonly aggregationService: AggregationService) {}

  @Get('reports')
  @ApiOperation({ summary: '查询当前用户的日报列表' })
  async listMyReports(
    @CurrentUserDecorator() user: CurrentUser,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.aggregationService.listUserReports(
      user.userId,
      page ? parseInt(page, 10) : 1,
      pageSize ? parseInt(pageSize, 10) : 20,
    );
  }

  @Get('reports/today')
  @ApiOperation({ summary: '查询当前用户今天的报告' })
  async getMyTodayReport(@CurrentUserDecorator() user: CurrentUser) {
    return this.aggregationService.getUserReport(user.userId, new Date());
  }

  @Post('run')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: '手动触发日报聚合(仅管理员)' })
  async runAggregation(@Query() query: DailyReportQueryDto) {
    const date = query.date ? new Date(query.date) : new Date();
    if (isNaN(date.getTime())) {
      throw new BadRequestException('日期格式无效,请使用 YYYY-MM-DD');
    }
    return this.aggregationService.aggregateDaily(date);
  }
}
