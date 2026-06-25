import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  BookingType,
  BookingStatus,
  Prisma,
  RoomType,
  RoomStatus,
} from '../../generated/prisma/client';

import { translateError } from '../common/i18n';
import {
  createPaginatedResult,
  getPaginationOptions,
  PaginationQuery,
} from '../common/pagination';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRoomDto } from './dto/create-room.dto';
import { UpdateRoomDto } from './dto/update-room.dto';

type RoomEntity = Awaited<
  ReturnType<PrismaService['room']['findFirstOrThrow']>
>;

type AvailabilityFilters = {
  startDate?: string;
  endDate?: string;
};

type AvailabilityBooking = {
  bookingType: BookingType;
  checkInDate: Date;
  checkOutDate: Date;
  checkInTime: Date | null;
  autoCheckoutAt: Date | null;
  status: BookingStatus;
};

export type TimeBasedRoomAvailabilityStatus =
  | 'AVAILABLE'
  | 'BOOKED'
  | 'OCCUPIED'
  | 'BLOCKED';

const roomSortFields = [
  'createdAt',
  'updatedAt',
  'roomNumber',
  'type',
  'pricePerNight',
  'status',
] as const;

@Injectable()
export class RoomsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createRoomDto: CreateRoomDto) {
    try {
      const room = await this.prisma.room.create({
        data: {
          ...createRoomDto,
          pricePerNight: new Prisma.Decimal(createRoomDto.pricePerNight),
        },
      });

      return this.serializeRoom(room);
    } catch (error) {
      this.handlePrismaError(error);
    }
  }

  async findAll(query: PaginationQuery) {
    const pagination = getPaginationOptions(query, {
      allowedSortBy: roomSortFields,
      defaultSortBy: 'createdAt',
    });
    const statusSearch = pagination.search
      ? this.getRoomStatusSearch(pagination.search)
      : undefined;
    const typeSearch = pagination.search
      ? this.getRoomTypeSearch(pagination.search)
      : undefined;
    const where: Prisma.RoomWhereInput = {
      deletedAt: null,
      ...(pagination.search
        ? {
            OR: [
              {
                roomNumber: {
                  contains: pagination.search,
                  mode: 'insensitive',
                },
              },
              ...(typeSearch ? [{ type: typeSearch }] : []),
              ...(statusSearch ? [{ status: statusSearch }] : []),
            ],
          }
        : {}),
    };

    const [rooms, total] = await Promise.all([
      this.prisma.room.findMany({
        where,
        orderBy: {
          [pagination.sortBy]: pagination.sortOrder,
        },
        skip: pagination.skip,
        take: pagination.limit,
      }),
      this.prisma.room.count({ where }),
    ]);

    return createPaginatedResult(
      rooms.map((room) => this.serializeRoom(room)),
      total,
      pagination,
    );
  }

  private getRoomStatusSearch(search: string) {
    const normalizedSearch = search.toUpperCase();

    return Object.values(RoomStatus).includes(normalizedSearch as RoomStatus)
      ? (normalizedSearch as RoomStatus)
      : undefined;
  }

  private getRoomTypeSearch(search: string) {
    const normalizedSearch = search.toUpperCase();

    return Object.values(RoomType).includes(normalizedSearch as RoomType)
      ? (normalizedSearch as RoomType)
      : undefined;
  }

  async findAllForOptions() {
    const rooms = await this.prisma.room.findMany({
      where: {
        deletedAt: null,
      },
      orderBy: {
        roomNumber: 'asc',
      },
    });

    return rooms.map((room) => this.serializeRoom(room));
  }

  async findOne(id: string) {
    const room = await this.findActiveRoomById(id);

    return this.serializeRoom(room);
  }

  async getAvailability(filters: AvailabilityFilters) {
    const dateRange = this.getDateRange(filters);
    const dates = this.getCalendarDates(dateRange.start, dateRange.end);
    const rooms = await this.prisma.room.findMany({
      where: {
        deletedAt: null,
      },
      include: {
        bookings: {
          where: {
            status: {
              in: [BookingStatus.CONFIRMED, BookingStatus.CHECKED_IN],
            },
            checkInDate: {
              lte: dateRange.end,
            },
            checkOutDate: {
              gt: dateRange.start,
            },
          },
        },
      },
      orderBy: {
        roomNumber: 'asc',
      },
    });

    return rooms.map((room) => ({
      roomId: room.id,
      roomNumber: room.roomNumber,
      roomType: room.type,
      pricePerNight: Number(room.pricePerNight),
      dates: dates.map((date) => ({
        date: this.formatDateKey(date),
        status: this.getRoomStatusForDate(room.status, room.bookings, date),
      })),
    }));
  }

  async checkRoomAvailability(
    roomId: string,
    startTimeValue: string | undefined,
    endTimeValue: string | undefined,
  ): Promise<TimeBasedRoomAvailabilityStatus> {
    const startTime = this.parseDateTime(startTimeValue, 'startTime');
    const endTime = this.parseDateTime(endTimeValue, 'endTime');

    if (endTime <= startTime) {
      throw new BadRequestException('endTime must be after startTime.');
    }

    const room = await this.prisma.room.findFirst({
      where: {
        id: roomId,
        deletedAt: null,
      },
      include: {
        bookings: {
          where: {
            status: {
              not: BookingStatus.CANCELLED,
            },
            OR: [
              {
                bookingType: BookingType.HOURLY,
                checkInTime: {
                  lt: endTime,
                },
                autoCheckoutAt: {
                  gt: startTime,
                },
              },
              {
                bookingType: {
                  not: BookingType.HOURLY,
                },
                checkInDate: {
                  lt: endTime,
                },
                checkOutDate: {
                  gt: startTime,
                },
              },
            ],
          },
          orderBy: {
            checkInDate: 'asc',
          },
        },
      },
    });

    if (!room) {
      throw new NotFoundException(translateError('roomNotFound'));
    }

    if (this.isMaintenanceStatus(room.status)) {
      return 'BOOKED';
    }

    const hourlyConflict = room.bookings.find(
      (booking) =>
        booking.bookingType === BookingType.HOURLY &&
        booking.checkInTime !== null &&
        booking.autoCheckoutAt !== null &&
        booking.checkInTime < endTime &&
        booking.autoCheckoutAt > startTime,
    );

    if (hourlyConflict) {
      return 'BLOCKED';
    }

    if (room.status === RoomStatus.OCCUPIED) {
      return 'OCCUPIED';
    }

    const activeConflict = room.bookings.find(
      (booking) =>
        booking.status === BookingStatus.CHECKED_IN &&
        booking.checkInDate < endTime &&
        booking.checkOutDate > startTime,
    );

    if (activeConflict) {
      return 'OCCUPIED';
    }

    const bookedConflict = room.bookings.find(
      (booking) =>
        booking.checkInDate < endTime && booking.checkOutDate > startTime,
    );

    if (bookedConflict) {
      return 'BOOKED';
    }

    return 'AVAILABLE';
  }

  async update(id: string, updateRoomDto: UpdateRoomDto) {
    await this.findActiveRoomById(id);

    try {
      const room = await this.prisma.room.update({
        where: { id },
        data: {
          ...updateRoomDto,
          pricePerNight:
            updateRoomDto.pricePerNight === undefined
              ? undefined
              : new Prisma.Decimal(updateRoomDto.pricePerNight),
        },
      });

      return this.serializeRoom(room);
    } catch (error) {
      this.handlePrismaError(error);
    }
  }

  async updateImage(id: string, imageUrl: string) {
    await this.findActiveRoomById(id);

    const room = await this.prisma.room.update({
      where: { id },
      data: { imageUrl },
    });

    return this.serializeRoom(room);
  }

  async remove(id: string) {
    await this.findActiveRoomById(id);

    const room = await this.prisma.room.update({
      where: { id },
      data: {
        deletedAt: new Date(),
      },
    });

    return this.serializeRoom(room);
  }

  private async findActiveRoomById(id: string) {
    const room = await this.prisma.room.findFirst({
      where: {
        id,
        deletedAt: null,
      },
    });

    if (!room) {
      throw new NotFoundException(translateError('roomNotFound'));
    }

    return room;
  }

  private getDateRange(filters: AvailabilityFilters) {
    if (!filters.startDate) {
      throw new BadRequestException('startDate is required.');
    }

    if (!filters.endDate) {
      throw new BadRequestException('endDate is required.');
    }

    const start = this.parseDate(filters.startDate, 'startDate');
    const end = this.parseDate(filters.endDate, 'endDate');

    if (start > end) {
      throw new BadRequestException('startDate must be before endDate.');
    }

    return { start, end };
  }

  private parseDate(value: string, fieldName: string) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      throw new BadRequestException(`${fieldName} must use YYYY-MM-DD format.`);
    }

    const date = new Date(`${value}T00:00:00.000Z`);

    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException(`${fieldName} must be a valid date.`);
    }

    return date;
  }

  private parseDateTime(value: string | undefined, fieldName: string) {
    if (!value) {
      throw new BadRequestException(`${fieldName} is required.`);
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException(`${fieldName} must be a valid date-time.`);
    }

    return date;
  }

  private getCalendarDates(start: Date, end: Date) {
    const dates: Date[] = [];
    const current = new Date(start);

    while (current <= end) {
      dates.push(new Date(current));
      current.setUTCDate(current.getUTCDate() + 1);
    }

    return dates;
  }

  private getRoomStatusForDate(
    roomStatus: RoomStatus,
    bookings: AvailabilityBooking[],
    date: Date,
  ) {
    if (this.isMaintenanceStatus(roomStatus)) {
      return roomStatus;
    }

    const booking = bookings.find(
      (bookingItem) =>
        date >= this.toUtcDateOnly(bookingItem.checkInDate) &&
        date < this.toUtcDateOnly(bookingItem.checkOutDate),
    );

    if (!booking) {
      return RoomStatus.AVAILABLE;
    }

    return booking.status === BookingStatus.CHECKED_IN
      ? RoomStatus.OCCUPIED
      : RoomStatus.BOOKED;
  }

  private isMaintenanceStatus(status: RoomStatus) {
    return (
      status === RoomStatus.MAINTENANCE ||
      status === RoomStatus.NEEDS_CLEANING ||
      status === RoomStatus.CLEANING_IN_PROGRESS
    );
  }

  private toUtcDateOnly(date: Date) {
    return new Date(
      Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
    );
  }

  private formatDateKey(date: Date) {
    return date.toISOString().slice(0, 10);
  }

  private handlePrismaError(error: unknown): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        throw new ConflictException('Room number already exists.');
      }

      if (error.code === 'P2025') {
        throw new NotFoundException(translateError('roomNotFound'));
      }
    }

    throw error;
  }

  private serializeRoom(room: RoomEntity) {
    return {
      ...room,
      pricePerNight: Number(room.pricePerNight),
    };
  }
}
