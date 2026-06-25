import { Injectable } from '@nestjs/common';

import {
  BookingStatus,
  BusinessType,
  HousekeepingPriority,
  HousekeepingStatus,
  PaymentStatus,
  Prisma,
  RoomStatus,
  UserRole,
} from '../../generated/prisma/client';
import { assertGuesthouseAccess } from '../common/business-access';
import { PrismaService } from '../prisma/prisma.service';

type RecentBooking = Prisma.BookingGetPayload<{
  include: {
    guest: true;
    room: true;
  };
}>;

type RecentPayment = Prisma.PaymentGetPayload<{
  include: {
    booking: {
      include: {
        guest: true;
        room: true;
      };
    };
  };
}>;

@Injectable()
export class DashboardService {
  private readonly recentLimit = 5;

  private readonly bookingInclude = {
    guest: true,
    room: true,
  } satisfies Prisma.BookingInclude;

  private readonly paymentInclude = {
    booking: {
      include: {
        guest: true,
        room: true,
      },
    },
  } satisfies Prisma.PaymentInclude;

  private readonly taskInclude = {
    room: { select: { roomNumber: true, type: true } },
    assignedTo: { select: { name: true } },
  } satisfies Prisma.HousekeepingTaskInclude;

  private readonly todayBookingInclude = {
    guest: { select: { fullName: true } },
    room: { select: { roomNumber: true } },
  } satisfies Prisma.BookingInclude;

  constructor(private readonly prisma: PrismaService) {}

  async getSummary() {
    const todayRange = this.getDayRange(new Date());
    const monthRange = this.getMonthRange(new Date());

    const [
      roomsByStatus,
      totalGuests,
      todayCheckIns,
      todayCheckOuts,
      totalRevenue,
      monthlyRevenue,
    ] = await Promise.all([
      this.prisma.room.groupBy({
        by: ['status'],
        where: {
          deletedAt: null,
        },
        _count: {
          _all: true,
        },
      }),
      this.prisma.guest.count(),
      this.prisma.booking.count({
        where: {
          status: {
            not: BookingStatus.CANCELLED,
          },
          checkInDate: {
            gte: todayRange.start,
            lt: todayRange.end,
          },
        },
      }),
      this.prisma.booking.count({
        where: {
          status: {
            not: BookingStatus.CANCELLED,
          },
          checkOutDate: {
            gte: todayRange.start,
            lt: todayRange.end,
          },
        },
      }),
      this.prisma.payment.aggregate({
        where: {
          status: PaymentStatus.PAID,
        },
        _sum: {
          amount: true,
        },
      }),
      this.prisma.payment.aggregate({
        where: {
          status: PaymentStatus.PAID,
          paidAt: {
            gte: monthRange.start,
            lt: monthRange.end,
          },
        },
        _sum: {
          amount: true,
        },
      }),
    ]);

    const roomCounts = this.getRoomCountsByStatus(roomsByStatus);

    return {
      totalRooms: Object.values(roomCounts).reduce(
        (total, count) => total + count,
        0,
      ),
      availableRooms: roomCounts[RoomStatus.AVAILABLE],
      bookedRooms: roomCounts[RoomStatus.BOOKED],
      occupiedRooms: roomCounts[RoomStatus.OCCUPIED],
      maintenanceRooms: roomCounts[RoomStatus.MAINTENANCE],
      cleaningRooms:
        roomCounts[RoomStatus.NEEDS_CLEANING] +
        roomCounts[RoomStatus.CLEANING_IN_PROGRESS],
      totalGuests,
      todayCheckIns,
      todayCheckOuts,
      totalRevenue: this.decimalToNumber(totalRevenue._sum.amount),
      monthlyRevenue: this.decimalToNumber(monthlyRevenue._sum.amount),
    };
  }

  async getTodaySummary(
    businessId: string,
    userId: string,
    userRole: UserRole,
  ) {
    await assertGuesthouseAccess(this.prisma, businessId, userId, userRole);

    const todayRange = this.getDayRange(new Date());
    const activeStatus = { not: BookingStatus.CANCELLED };

    const [checkInBookings, checkOutBookings, roomsByStatus, paidToday] =
      await Promise.all([
        this.prisma.booking.findMany({
          where: {
            status: activeStatus,
            checkInDate: { gte: todayRange.start, lt: todayRange.end },
          },
          include: this.todayBookingInclude,
          orderBy: { checkInDate: 'asc' },
        }),
        this.prisma.booking.findMany({
          where: {
            status: activeStatus,
            checkOutDate: { gte: todayRange.start, lt: todayRange.end },
          },
          include: this.todayBookingInclude,
          orderBy: { checkOutDate: 'asc' },
        }),
        this.prisma.room.groupBy({
          by: ['status'],
          where: { deletedAt: null },
          _count: { _all: true },
        }),
        this.prisma.payment.aggregate({
          where: {
            status: PaymentStatus.PAID,
            paidAt: { gte: todayRange.start, lt: todayRange.end },
          },
          _sum: { amount: true },
        }),
      ]);

    const roomCounts = this.getRoomCountsByStatus(roomsByStatus);

    return {
      todayCheckIns: checkInBookings.map((booking) => ({
        bookingId: booking.id,
        guestName: booking.guest.fullName,
        roomNumber: booking.room.roomNumber,
        checkInTime: booking.checkInAt,
      })),
      todayCheckOuts: checkOutBookings.map((booking) => ({
        bookingId: booking.id,
        guestName: booking.guest.fullName,
        roomNumber: booking.room.roomNumber,
        checkOutTime: booking.checkOutAt,
      })),
      availableRooms: roomCounts[RoomStatus.AVAILABLE],
      occupiedRooms: roomCounts[RoomStatus.OCCUPIED],
      needsCleaningRooms: roomCounts[RoomStatus.NEEDS_CLEANING],
      totalRevenueToday: this.decimalToNumber(paidToday._sum.amount),
    };
  }

  async getRecentBookings() {
    const bookings = await this.prisma.booking.findMany({
      take: this.recentLimit,
      include: this.bookingInclude,
      orderBy: {
        createdAt: 'desc',
      },
    });

    return bookings.map((booking) => this.serializeBooking(booking));
  }

  async getRecentPayments() {
    const payments = await this.prisma.payment.findMany({
      take: this.recentLimit,
      include: this.paymentInclude,
      orderBy: {
        createdAt: 'desc',
      },
    });

    return payments.map((payment) => this.serializePayment(payment));
  }

  async getHousekeepingSummary() {
    const todayRange = this.getDayRange(new Date());

    const guesthouse = await this.prisma.business.findFirst({
      where: { type: BusinessType.GUESTHOUSE },
      select: { id: true },
    });

    if (!guesthouse) {
      return {
        needsCleaning: 0,
        cleaningInProgress: 0,
        cleanedWaitingInspection: 0,
        completedToday: 0,
        todaysTasks: [],
        urgentTasks: [],
      };
    }

    const businessId = guesthouse.id;
    const TERMINAL = [
      HousekeepingStatus.INSPECTED,
      HousekeepingStatus.CANCELLED,
    ];

    const [
      needsCleaning,
      cleaningInProgress,
      cleanedWaitingInspection,
      completedToday,
      todaysTasks,
      urgentTasks,
    ] = await Promise.all([
      this.prisma.housekeepingTask.count({
        where: { businessId, status: HousekeepingStatus.NEEDS_CLEANING },
      }),
      this.prisma.housekeepingTask.count({
        where: { businessId, status: HousekeepingStatus.CLEANING_IN_PROGRESS },
      }),
      this.prisma.housekeepingTask.count({
        where: { businessId, status: HousekeepingStatus.CLEANED },
      }),
      this.prisma.housekeepingTask.count({
        where: {
          businessId,
          status: HousekeepingStatus.INSPECTED,
          inspectedAt: { gte: todayRange.start, lt: todayRange.end },
        },
      }),
      this.prisma.housekeepingTask.findMany({
        where: {
          businessId,
          status: { notIn: TERMINAL },
          createdAt: { gte: todayRange.start, lt: todayRange.end },
        },
        include: this.taskInclude,
        orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
        take: 8,
      }),
      this.prisma.housekeepingTask.findMany({
        where: {
          businessId,
          priority: HousekeepingPriority.URGENT,
          status: { notIn: TERMINAL },
        },
        include: this.taskInclude,
        orderBy: { createdAt: 'asc' },
        take: 8,
      }),
    ]);

    return {
      needsCleaning,
      cleaningInProgress,
      cleanedWaitingInspection,
      completedToday,
      todaysTasks,
      urgentTasks,
    };
  }

  private getRoomCountsByStatus(
    roomsByStatus: Array<{ status: RoomStatus; _count: { _all: number } }>,
  ) {
    const counts: Record<RoomStatus, number> = {
      [RoomStatus.AVAILABLE]: 0,
      [RoomStatus.BOOKED]: 0,
      [RoomStatus.OCCUPIED]: 0,
      [RoomStatus.MAINTENANCE]: 0,
      [RoomStatus.NEEDS_CLEANING]: 0,
      [RoomStatus.CLEANING_IN_PROGRESS]: 0,
    };

    for (const roomStatus of roomsByStatus) {
      counts[roomStatus.status] = roomStatus._count._all;
    }

    return counts;
  }

  private getDayRange(date: Date) {
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);

    const end = new Date(start);
    end.setDate(end.getDate() + 1);

    return { start, end };
  }

  private getMonthRange(date: Date) {
    const start = new Date(date.getFullYear(), date.getMonth(), 1);
    const end = new Date(date.getFullYear(), date.getMonth() + 1, 1);

    return { start, end };
  }

  private decimalToNumber(value: Prisma.Decimal | null) {
    return value === null ? 0 : Number(value);
  }

  private serializeBooking(booking: RecentBooking) {
    return {
      ...booking,
      totalPrice: Number(booking.totalPrice),
      room: {
        ...booking.room,
        pricePerNight: Number(booking.room.pricePerNight),
      },
    };
  }

  private serializePayment(payment: RecentPayment) {
    return {
      ...payment,
      amount: Number(payment.amount),
      booking: {
        ...payment.booking,
        totalPrice: Number(payment.booking.totalPrice),
        room: {
          ...payment.booking.room,
          pricePerNight: Number(payment.booking.room.pricePerNight),
        },
      },
    };
  }
}
