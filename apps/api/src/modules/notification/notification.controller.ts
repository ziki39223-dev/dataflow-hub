import { Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { ParseIntPipe } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUserDecorator } from 'src/common/decorators/current-user.decorator';
import { CurrentUser } from 'src/common/types/jwt-payload.interface';
import { QueryNotificationDto } from './dto/query-notification.dto';
import { NotificationService } from './notification.service';

@ApiTags('notification')
@ApiBearerAuth('access-token')
@Controller('notification')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Get()
  @ApiOperation({ summary: '通知列表(支持过滤分页)' })
  findAll(@Query() query: QueryNotificationDto, @CurrentUserDecorator() currentUser: CurrentUser) {
    return this.notificationService.findAll(query, currentUser);
  }

  @Get('unread-count')
  @ApiOperation({ summary: '当前用户未读通知数' })
  findUnreadCount(@CurrentUserDecorator() currentUser: CurrentUser) {
    return this.notificationService.findUnreadCount(currentUser);
  }

  @Patch('read-all')
  @ApiOperation({ summary: '标记当前用户所有未读通知为已读' })
  markAllAsRead(@CurrentUserDecorator() currentUser: CurrentUser) {
    return this.notificationService.markAllAsRead(currentUser);
  }

  @Patch(':id/read')
  @ApiOperation({ summary: '标记单条通知为已读' })
  markAsRead(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUserDecorator() currentUser: CurrentUser,
  ) {
    return this.notificationService.markAsRead(id, currentUser);
  }
}
