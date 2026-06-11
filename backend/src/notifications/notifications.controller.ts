import { Controller, Delete, Get, Param, Patch, Query } from '@nestjs/common';

import { UserRole } from '../../generated/prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import type { AuthUser } from '../auth/types';
import { apiResponse } from '../common/api-response';
import type { PaginationQuery } from '../common/pagination';
import { NotificationsService } from './notifications.service';

@Roles(UserRole.ADMIN, UserRole.RECEPTIONIST)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  async findAll(
    @CurrentUser() currentUser: AuthUser,
    @Query() query: PaginationQuery & { all?: string },
  ) {
    const notifications = await this.notificationsService.findAll(
      currentUser,
      query,
    );

    return notifications;
  }

  @Patch('read-all')
  async markAllAsRead(@CurrentUser() currentUser: AuthUser) {
    const notifications =
      await this.notificationsService.markAllAsRead(currentUser);

    return apiResponse('Notifications marked as read.', notifications);
  }

  @Patch(':id/read')
  async markAsRead(
    @Param('id') id: string,
    @CurrentUser() currentUser: AuthUser,
  ) {
    const notification = await this.notificationsService.markAsRead(
      id,
      currentUser,
    );

    return apiResponse('Notification marked as read.', notification);
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @CurrentUser() currentUser: AuthUser) {
    const notification = await this.notificationsService.remove(
      id,
      currentUser,
    );

    return apiResponse('Notification deleted successfully.', notification);
  }
}
