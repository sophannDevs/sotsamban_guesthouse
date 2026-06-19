import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import {
  BookingStatus,
  Business,
  BusinessRole,
  BusinessType,
  HousekeepingPriority,
  HousekeepingStatus,
  Prisma,
  RoomStatus,
  UserRole,
} from '../../generated/prisma/client';
import {
  createPaginatedResult,
  getPaginationOptions,
  PaginationQuery,
} from '../common/pagination';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthUser } from '../auth/types';
import { CreateHousekeepingTaskDto } from './dto/create-housekeeping-task.dto';
import { UpdateHousekeepingTaskDto } from './dto/update-housekeeping-task.dto';

export type HousekeepingTaskQuery = {
  status?: HousekeepingStatus;
  priority?: HousekeepingPriority;
  roomId?: string;
  assignedToId?: string;
  startDate?: string;
  endDate?: string;
};

type HousekeepingRole = 'MANAGER' | 'RECEPTIONIST' | 'STAFF';

type HousekeepingTaskWithRelations = Prisma.HousekeepingTaskGetPayload<{
  include: {
    room: {
      select: {
        id: true;
        roomNumber: true;
        type: true;
        pricePerNight: true;
        status: true;
      };
    };
    assignedTo: {
      select: {
        id: true;
        name: true;
        email: true;
      };
    };
    booking: {
      select: {
        id: true;
        status: true;
        checkInDate: true;
        checkOutDate: true;
        guest: {
          select: {
            id: true;
            fullName: true;
            phone: true;
          };
        };
      };
    };
  };
}>;

const taskSortFields = [
  'createdAt',
  'updatedAt',
  'status',
  'priority',
  'startedAt',
  'completedAt',
  'inspectedAt',
] as const;

const TERMINAL_STATUSES = [
  HousekeepingStatus.INSPECTED,
  HousekeepingStatus.CANCELLED,
] as const;

const ACTIVE_BOOKING_STATUSES = [
  BookingStatus.PENDING,
  BookingStatus.CONFIRMED,
  BookingStatus.CHECKED_IN,
] as const;

@Injectable()
export class HousekeepingService {
  private readonly taskInclude = {
    room: {
      select: {
        id: true,
        roomNumber: true,
        type: true,
        pricePerNight: true,
        status: true,
      },
    },
    assignedTo: {
      select: {
        id: true,
        name: true,
        email: true,
      },
    },
    booking: {
      select: {
        id: true,
        status: true,
        checkInDate: true,
        checkOutDate: true,
        guest: {
          select: {
            id: true,
            fullName: true,
            phone: true,
          },
        },
      },
    },
  } satisfies Prisma.HousekeepingTaskInclude;

  constructor(private readonly prisma: PrismaService) {}

  async create(
    dto: CreateHousekeepingTaskDto,
    businessId: string,
    currentUser: AuthUser,
  ) {
    await this.validateGuestHouseAccess(businessId);
    const role = await this.resolveHousekeepingRole(
      businessId,
      currentUser.userId,
      currentUser.role,
    );

    if (role === 'STAFF') {
      throw new ForbiddenException('Staff cannot create housekeeping tasks.');
    }

    if (dto.assignedToId && role !== 'MANAGER') {
      throw new ForbiddenException(
        'Only managers can assign housekeeping tasks.',
      );
    }

    const room = await this.prisma.room.findFirst({
      where: { id: dto.roomId, deletedAt: null },
    });
    if (!room) {
      throw new NotFoundException('Room not found.');
    }

    const existingActive = await this.prisma.housekeepingTask.findFirst({
      where: {
        roomId: dto.roomId,
        status: { notIn: [...TERMINAL_STATUSES] },
      },
    });
    if (existingActive) {
      throw new ConflictException(
        'An active housekeeping task already exists for this room.',
      );
    }

    const task = await this.prisma.housekeepingTask.create({
      data: {
        businessId,
        roomId: dto.roomId,
        assignedToId: dto.assignedToId ?? null,
        status: dto.status ?? HousekeepingStatus.NEEDS_CLEANING,
        priority: dto.priority ?? HousekeepingPriority.MEDIUM,
        note: dto.note ?? null,
      },
      include: this.taskInclude,
    });

    return this.serialize(task);
  }

  async findAll(
    businessId: string,
    query: PaginationQuery & HousekeepingTaskQuery,
    currentUser: AuthUser,
  ) {
    await this.validateGuestHouseAccess(businessId);
    const role = await this.resolveHousekeepingRole(
      businessId,
      currentUser.userId,
      currentUser.role,
    );

    const pagination = getPaginationOptions(query, {
      allowedSortBy: taskSortFields,
      defaultSortBy: 'createdAt',
    });

    const where: Prisma.HousekeepingTaskWhereInput = {
      businessId,
      ...(role === 'STAFF' ? { assignedToId: currentUser.userId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.priority ? { priority: query.priority } : {}),
      ...(query.roomId ? { roomId: query.roomId } : {}),
      ...(query.assignedToId ? { assignedToId: query.assignedToId } : {}),
      ...(query.startDate || query.endDate
        ? {
            createdAt: {
              ...(query.startDate ? { gte: new Date(query.startDate) } : {}),
              ...(query.endDate
                ? { lte: new Date(`${query.endDate}T23:59:59.999Z`) }
                : {}),
            },
          }
        : {}),
      ...(pagination.search
        ? {
            OR: [
              {
                room: {
                  roomNumber: {
                    contains: pagination.search,
                    mode: 'insensitive',
                  },
                },
              },
              {
                note: { contains: pagination.search, mode: 'insensitive' },
              },
            ],
          }
        : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.housekeepingTask.findMany({
        where,
        include: this.taskInclude,
        orderBy: { [pagination.sortBy]: pagination.sortOrder },
        skip: pagination.skip,
        take: pagination.limit,
      }),
      this.prisma.housekeepingTask.count({ where }),
    ]);

    return createPaginatedResult(
      data.map((t) => this.serialize(t)),
      total,
      pagination,
    );
  }

  async findOne(id: string, businessId: string, currentUser: AuthUser) {
    await this.validateGuestHouseAccess(businessId);
    const role = await this.resolveHousekeepingRole(
      businessId,
      currentUser.userId,
      currentUser.role,
    );

    const task = await this.findTaskOrThrow(id, businessId);

    if (role === 'STAFF' && task.assignedToId !== currentUser.userId) {
      throw new ForbiddenException('You can only view tasks assigned to you.');
    }

    return this.serialize(task);
  }

  async update(
    id: string,
    dto: UpdateHousekeepingTaskDto,
    businessId: string,
    currentUser: AuthUser,
  ) {
    await this.validateGuestHouseAccess(businessId);
    const role = await this.resolveHousekeepingRole(
      businessId,
      currentUser.userId,
      currentUser.role,
    );

    if (role === 'STAFF') {
      throw new ForbiddenException(
        'Staff cannot update housekeeping tasks directly.',
      );
    }

    if (dto.assignedToId !== undefined && role !== 'MANAGER') {
      throw new ForbiddenException(
        'Only managers can assign housekeeping tasks.',
      );
    }

    await this.findTaskOrThrow(id, businessId);

    const updated = await this.prisma.housekeepingTask.update({
      where: { id },
      data: {
        ...(dto.assignedToId !== undefined
          ? { assignedToId: dto.assignedToId ?? null }
          : {}),
        ...(dto.priority !== undefined ? { priority: dto.priority } : {}),
        ...(dto.note !== undefined ? { note: dto.note ?? null } : {}),
      },
      include: this.taskInclude,
    });

    return this.serialize(updated);
  }

  async start(id: string, businessId: string, currentUser: AuthUser) {
    await this.validateGuestHouseAccess(businessId);
    const role = await this.resolveHousekeepingRole(
      businessId,
      currentUser.userId,
      currentUser.role,
    );

    const task = await this.findTaskOrThrow(id, businessId);

    if (role === 'STAFF' && task.assignedToId !== currentUser.userId) {
      throw new ForbiddenException('You can only start tasks assigned to you.');
    }

    if (task.status !== HousekeepingStatus.NEEDS_CLEANING) {
      throw new ConflictException(
        `Task must be in NEEDS_CLEANING status to start. Current: ${task.status}`,
      );
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const updatedTask = await tx.housekeepingTask.update({
        where: { id },
        data: {
          status: HousekeepingStatus.CLEANING_IN_PROGRESS,
          startedAt: new Date(),
        },
        include: this.taskInclude,
      });

      await tx.room.update({
        where: { id: task.roomId },
        data: { status: RoomStatus.CLEANING_IN_PROGRESS },
      });

      return updatedTask;
    });

    return this.serialize(updated);
  }

  async complete(id: string, businessId: string, currentUser: AuthUser) {
    await this.validateGuestHouseAccess(businessId);
    const role = await this.resolveHousekeepingRole(
      businessId,
      currentUser.userId,
      currentUser.role,
    );

    const task = await this.findTaskOrThrow(id, businessId);

    if (role === 'STAFF' && task.assignedToId !== currentUser.userId) {
      throw new ForbiddenException(
        'You can only complete tasks assigned to you.',
      );
    }

    if (task.status !== HousekeepingStatus.CLEANING_IN_PROGRESS) {
      throw new ConflictException(
        `Task must be in CLEANING_IN_PROGRESS status to complete. Current: ${task.status}`,
      );
    }

    const updated = await this.prisma.housekeepingTask.update({
      where: { id },
      data: {
        status: HousekeepingStatus.CLEANED,
        completedAt: new Date(),
      },
      include: this.taskInclude,
    });

    return this.serialize(updated);
  }

  async inspect(id: string, businessId: string, currentUser: AuthUser) {
    await this.validateGuestHouseAccess(businessId);
    const role = await this.resolveHousekeepingRole(
      businessId,
      currentUser.userId,
      currentUser.role,
    );

    if (role !== 'MANAGER') {
      throw new ForbiddenException(
        'Only managers can inspect housekeeping tasks.',
      );
    }

    const task = await this.findTaskOrThrow(id, businessId);

    if (task.status !== HousekeepingStatus.CLEANED) {
      throw new ConflictException(
        `Task must be in CLEANED status to inspect. Current: ${task.status}`,
      );
    }

    const [blockingBooking, room] = await Promise.all([
      this.prisma.booking.findFirst({
        where: {
          roomId: task.roomId,
          status: { in: [...ACTIVE_BOOKING_STATUSES] },
        },
      }),
      this.prisma.room.findUnique({
        where: { id: task.roomId },
        select: { status: true },
      }),
    ]);

    const roomBlocked =
      room?.status === RoomStatus.MAINTENANCE || !!blockingBooking;

    const updated = await this.prisma.$transaction(async (tx) => {
      const inspectedTask = await tx.housekeepingTask.update({
        where: { id },
        data: {
          status: HousekeepingStatus.INSPECTED,
          inspectedAt: new Date(),
        },
        include: this.taskInclude,
      });

      if (!roomBlocked) {
        await tx.room.update({
          where: { id: task.roomId },
          data: { status: RoomStatus.AVAILABLE },
        });
      }

      return inspectedTask;
    });

    return this.serialize(updated);
  }

  async cancel(id: string, businessId: string, currentUser: AuthUser) {
    await this.validateGuestHouseAccess(businessId);
    const role = await this.resolveHousekeepingRole(
      businessId,
      currentUser.userId,
      currentUser.role,
    );

    if (role !== 'MANAGER') {
      throw new ForbiddenException(
        'Only managers can cancel housekeeping tasks.',
      );
    }

    const task = await this.findTaskOrThrow(id, businessId);

    if ((TERMINAL_STATUSES as readonly HousekeepingStatus[]).includes(task.status)) {
      throw new ConflictException(
        `Task with status ${task.status} cannot be cancelled.`,
      );
    }

    const updated = await this.prisma.housekeepingTask.update({
      where: { id },
      data: { status: HousekeepingStatus.CANCELLED },
      include: this.taskInclude,
    });

    return this.serialize(updated);
  }

  async remove(id: string, businessId: string, currentUser: AuthUser) {
    await this.validateGuestHouseAccess(businessId);
    const role = await this.resolveHousekeepingRole(
      businessId,
      currentUser.userId,
      currentUser.role,
    );

    if (role !== 'MANAGER') {
      throw new ForbiddenException(
        'Only managers can delete housekeeping tasks.',
      );
    }

    await this.findTaskOrThrow(id, businessId);

    const deleted = await this.prisma.housekeepingTask.delete({
      where: { id },
      include: this.taskInclude,
    });

    return this.serialize(deleted);
  }

  private async validateGuestHouseAccess(
    businessId: string,
  ): Promise<Business> {
    if (!businessId) {
      throw new BadRequestException('x-business-id header is required.');
    }

    const business = await this.prisma.business.findUnique({
      where: { id: businessId },
    });

    if (!business) {
      throw new NotFoundException('Business not found.');
    }

    if (business.type !== BusinessType.GUESTHOUSE) {
      throw new ForbiddenException(
        'This endpoint is only available for GUESTHOUSE businesses.',
      );
    }

    return business;
  }

  private async resolveHousekeepingRole(
    businessId: string,
    userId: string,
    userRole: UserRole,
  ): Promise<HousekeepingRole> {
    if (userRole === UserRole.ADMIN) {
      return 'MANAGER';
    }

    const member = await this.prisma.businessMember.findUnique({
      where: { businessId_userId: { businessId, userId } },
    });

    if (member) {
      if (
        member.role === BusinessRole.OWNER ||
        member.role === BusinessRole.ADMIN
      ) {
        return 'MANAGER';
      }
      if (member.role === BusinessRole.STAFF) {
        return 'STAFF';
      }
    }

    return 'RECEPTIONIST';
  }

  private async findTaskOrThrow(
    id: string,
    businessId: string,
  ): Promise<HousekeepingTaskWithRelations> {
    const task = await this.prisma.housekeepingTask.findFirst({
      where: { id, businessId },
      include: this.taskInclude,
    });

    if (!task) {
      throw new NotFoundException('Housekeeping task not found.');
    }

    return task;
  }

  private serialize(task: HousekeepingTaskWithRelations) {
    return {
      id: task.id,
      businessId: task.businessId,
      roomId: task.roomId,
      assignedToId: task.assignedToId,
      bookingId: task.bookingId,
      status: task.status,
      priority: task.priority,
      note: task.note,
      startedAt: task.startedAt,
      completedAt: task.completedAt,
      inspectedAt: task.inspectedAt,
      room: task.room,
      assignedTo: task.assignedTo,
      booking: task.booking,
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
    };
  }
}
