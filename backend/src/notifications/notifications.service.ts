import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import {
  NotificationType,
  Prisma,
  UserRole,
} from '../../generated/prisma/client';
import { AuthUser } from '../auth/types';
import {
  createPaginatedResult,
  getPaginationOptions,
  PaginationQuery,
} from '../common/pagination';
import { PrismaService } from '../prisma/prisma.service';

type CreateNotificationPayload = {
  userId: string;
  title: string;
  message: string;
  type: NotificationType;
};

const notificationSortFields = [
  'createdAt',
  'updatedAt',
  'title',
  'type',
  'isRead',
] as const;

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    currentUser: AuthUser,
    query: PaginationQuery & { all?: string } = {},
  ) {
    const pagination = getPaginationOptions(query, {
      allowedSortBy: notificationSortFields,
      defaultSortBy: 'createdAt',
    });
    const canViewAll =
      currentUser.role === UserRole.ADMIN && query.all === 'true';
    const where: Prisma.NotificationWhereInput = {
      ...(canViewAll ? {} : { userId: currentUser.userId }),
      ...(pagination.search
        ? {
            OR: [
              {
                title: {
                  contains: pagination.search,
                  mode: 'insensitive' as const,
                },
              },
              {
                message: {
                  contains: pagination.search,
                  mode: 'insensitive' as const,
                },
              },
            ],
          }
        : {}),
    };
    const [notifications, total] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        orderBy: {
          [pagination.sortBy]: pagination.sortOrder,
        },
        skip: pagination.skip,
        take: pagination.limit,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
            },
          },
        },
      }),
      this.prisma.notification.count({ where }),
    ]);

    return createPaginatedResult(notifications, total, pagination);
  }

  async markAsRead(id: string, currentUser: AuthUser) {
    await this.ensureNotificationAccess(id, currentUser);

    return this.prisma.notification.update({
      where: { id },
      data: { isRead: true },
    });
  }

  async markAllAsRead(currentUser: AuthUser) {
    await this.prisma.notification.updateMany({
      where: { userId: currentUser.userId, isRead: false },
      data: { isRead: true },
    });

    return this.findAll(currentUser);
  }

  async remove(id: string, currentUser: AuthUser) {
    await this.ensureNotificationAccess(id, currentUser);

    return this.prisma.notification.delete({
      where: { id },
    });
  }

  async createForUser(payload: CreateNotificationPayload) {
    return this.prisma.notification.create({
      data: payload,
    });
  }

  async notifyBookingCreated(userId: string, bookingId: string) {
    return this.createForUser({
      userId,
      title: 'Booking created',
      message: `Booking ${bookingId} was created successfully.`,
      type: NotificationType.BOOKING,
    });
  }

  async notifyBookingCheckedIn(userId: string, bookingId: string) {
    return this.createForUser({
      userId,
      title: 'Guest checked in',
      message: `Booking ${bookingId} has been checked in.`,
      type: NotificationType.BOOKING,
    });
  }

  async notifyBookingCheckedOut(userId: string, bookingId: string) {
    return this.createForUser({
      userId,
      title: 'Guest checked out',
      message: `Booking ${bookingId} has been checked out.`,
      type: NotificationType.BOOKING,
    });
  }

  async notifyPaymentPaid(
    userId: string,
    paymentId: string,
    bookingId: string,
  ) {
    return this.createForUser({
      userId,
      title: 'Payment paid',
      message: `Payment ${paymentId} for booking ${bookingId} is paid.`,
      type: NotificationType.PAYMENT,
    });
  }

  async notifyMaintenanceCreated(userId: string, title: string) {
    return this.createForUser({
      userId,
      title: 'Maintenance request created',
      message: title,
      type: NotificationType.MAINTENANCE,
    });
  }

  async notifyMaintenanceResolved(userId: string, title: string) {
    return this.createForUser({
      userId,
      title: 'Maintenance resolved',
      message: title,
      type: NotificationType.MAINTENANCE,
    });
  }

  private async ensureNotificationAccess(id: string, currentUser: AuthUser) {
    const notification = await this.prisma.notification.findUnique({
      where: { id },
    });

    if (!notification) {
      throw new NotFoundException('Notification not found.');
    }

    if (
      notification.userId !== currentUser.userId &&
      currentUser.role !== UserRole.ADMIN
    ) {
      throw new ForbiddenException('You cannot access this notification.');
    }

    return notification;
  }
}
