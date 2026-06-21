import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  BookingStatus,
  BusinessType,
  CoolingOption,
  HousekeepingPriority,
  HousekeepingStatus,
  Prisma,
  RoomStatus,
} from '../../generated/prisma/client';

import {
  computeBalanceDue,
  computeTotalPrice,
  getMiniBarTotalForBooking,
  getMiniBarTotalsByBookingIds,
  getPaidAmountForBooking,
  getPaidAmountsByBookingIds,
} from '../common/booking-totals';
import { translateError } from '../common/i18n';
import {
  createPaginatedResult,
  getPaginationOptions,
  PaginationQuery,
} from '../common/pagination';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { SettingsService } from '../settings/settings.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { UpdateBookingDto } from './dto/update-booking.dto';

type BookingWithRelations = Prisma.BookingGetPayload<{
  include: {
    guest: true;
    room: true;
  };
}>;

type RoomEntity = Awaited<
  ReturnType<PrismaService['room']['findFirstOrThrow']>
>;

const bookingSortFields = [
  'createdAt',
  'updatedAt',
  'checkInDate',
  'checkOutDate',
  'totalPrice',
  'status',
] as const;

@Injectable()
export class BookingsService {
  private readonly bookingInclude = {
    guest: true,
    room: true,
  } satisfies Prisma.BookingInclude;

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
    private readonly settingsService: SettingsService,
  ) {}

  async create(createBookingDto: CreateBookingDto, actorUserId?: string) {
    const status = createBookingDto.status ?? BookingStatus.PENDING;
    const coolingOption = createBookingDto.coolingOption ?? CoolingOption.FAN;
    const checkInDate = this.parseDate(createBookingDto.checkInDate);
    const checkOutDate = this.parseDate(createBookingDto.checkOutDate);

    this.validateDateRange(checkInDate, checkOutDate);

    const [guest, room] = await Promise.all([
      this.findGuest(createBookingDto.guestId),
      this.findActiveRoom(createBookingDto.roomId),
    ]);

    await this.ensureRoomCanBeBooked(room, checkInDate, checkOutDate);

    const acPricePerNight = await this.fetchAcPricePerNight();
    const { roomPriceTotal, coolingPrice, totalPrice } = this.calculatePricing(
      checkInDate,
      checkOutDate,
      room.pricePerNight,
      coolingOption,
      acPricePerNight,
    );

    const booking = await this.prisma.$transaction(async (tx) => {
      if (status === BookingStatus.CONFIRMED) {
        await tx.room.update({
          where: { id: room.id },
          data: { status: RoomStatus.BOOKED },
        });
      }

      return tx.booking.create({
        data: {
          guestId: guest.id,
          roomId: room.id,
          checkInDate,
          checkOutDate,
          coolingOption,
          roomPriceTotal,
          coolingPrice,
          totalPrice,
          status,
        },
        include: this.bookingInclude,
      });
    });

    if (actorUserId) {
      await this.notificationsService.notifyBookingCreated(
        actorUserId,
        booking.id,
      );
    }

    return this.serializeBooking(booking);
  }

  async findAll(query: PaginationQuery & { status?: BookingStatus }) {
    const pagination = getPaginationOptions(query, {
      allowedSortBy: bookingSortFields,
      defaultSortBy: 'createdAt',
    });

    if (query.status && !this.isBookingStatus(query.status)) {
      throw new BadRequestException(
        `status must be one of the following values: ${Object.values(
          BookingStatus,
        ).join(', ')}`,
      );
    }

    const where: Prisma.BookingWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(pagination.search
        ? {
            OR: [
              {
                id: {
                  contains: pagination.search,
                  mode: 'insensitive',
                },
              },
              {
                guest: {
                  fullName: {
                    contains: pagination.search,
                    mode: 'insensitive',
                  },
                },
              },
              {
                room: {
                  roomNumber: {
                    contains: pagination.search,
                    mode: 'insensitive',
                  },
                },
              },
            ],
          }
        : {}),
    };

    const [bookings, total] = await Promise.all([
      this.prisma.booking.findMany({
        where,
        include: this.bookingInclude,
        orderBy: {
          [pagination.sortBy]: pagination.sortOrder,
        },
        skip: pagination.skip,
        take: pagination.limit,
      }),
      this.prisma.booking.count({ where }),
    ]);

    return createPaginatedResult(
      await this.serializeBookingsList(bookings),
      total,
      pagination,
    );
  }

  async findOne(id: string) {
    const booking = await this.findBookingById(id);

    return this.serializeBooking(booking);
  }

  async checkIn(id: string, actorUserId?: string) {
    const existingBooking = await this.findBookingById(id);

    if (existingBooking.status !== BookingStatus.CONFIRMED) {
      throw new ConflictException(
        translateError('onlyConfirmedBookingsCanCheckIn'),
      );
    }

    const booking = await this.prisma.$transaction(async (tx) => {
      await tx.room.update({
        where: { id: existingBooking.roomId },
        data: { status: RoomStatus.OCCUPIED },
      });

      return tx.booking.update({
        where: { id },
        data: { status: BookingStatus.CHECKED_IN },
        include: this.bookingInclude,
      });
    });

    if (actorUserId) {
      await this.notificationsService.notifyBookingCheckedIn(
        actorUserId,
        booking.id,
      );
    }

    return this.serializeBooking(booking);
  }

  async checkOut(id: string, actorUserId?: string) {
    const existingBooking = await this.findBookingById(id);

    if (existingBooking.status !== BookingStatus.CHECKED_IN) {
      throw new ConflictException(
        translateError('onlyCheckedInBookingsCanCheckOut'),
      );
    }

    const guesthouse = await this.prisma.business.findFirst({
      where: { type: BusinessType.GUESTHOUSE },
      select: { id: true },
    });

    const booking = await this.prisma.$transaction(async (tx) => {
      await tx.room.update({
        where: { id: existingBooking.roomId },
        data: { status: RoomStatus.NEEDS_CLEANING },
      });

      const updatedBooking = await tx.booking.update({
        where: { id },
        data: { status: BookingStatus.CHECKED_OUT },
        include: this.bookingInclude,
      });

      if (guesthouse) {
        const existingTask = await tx.housekeepingTask.findFirst({
          where: {
            roomId: existingBooking.roomId,
            bookingId: id,
            status: { not: HousekeepingStatus.CANCELLED },
          },
        });

        if (!existingTask) {
          await tx.housekeepingTask.create({
            data: {
              businessId: guesthouse.id,
              roomId: existingBooking.roomId,
              bookingId: id,
              status: HousekeepingStatus.NEEDS_CLEANING,
              priority: HousekeepingPriority.MEDIUM,
              note: 'Room needs cleaning after check-out',
            },
          });
        }
      }

      return updatedBooking;
    });

    if (actorUserId) {
      await this.notificationsService.notifyBookingCheckedOut(
        actorUserId,
        booking.id,
      );
    }

    return this.serializeBooking(booking);
  }

  async cancel(id: string) {
    const existingBooking = await this.findBookingById(id);

    const booking = await this.prisma.$transaction(async (tx) => {
      await tx.booking.update({
        where: { id },
        data: { status: BookingStatus.CANCELLED },
      });

      const activeBooking = await tx.booking.findFirst({
        where: {
          id: { not: id },
          roomId: existingBooking.roomId,
          status: {
            in: [
              BookingStatus.PENDING,
              BookingStatus.CONFIRMED,
              BookingStatus.CHECKED_IN,
            ],
          },
        },
      });

      if (!activeBooking) {
        await tx.room.update({
          where: { id: existingBooking.roomId },
          data: { status: RoomStatus.AVAILABLE },
        });
      }

      return tx.booking.findUniqueOrThrow({
        where: { id },
        include: this.bookingInclude,
      });
    });

    return this.serializeBooking(booking);
  }

  async update(id: string, updateBookingDto: UpdateBookingDto) {
    const existingBooking = await this.findBookingById(id);
    const roomId = updateBookingDto.roomId ?? existingBooking.roomId;
    const guestId = updateBookingDto.guestId ?? existingBooking.guestId;
    const coolingOption =
      updateBookingDto.coolingOption ?? existingBooking.coolingOption;
    const checkInDate = updateBookingDto.checkInDate
      ? this.parseDate(updateBookingDto.checkInDate)
      : existingBooking.checkInDate;
    const checkOutDate = updateBookingDto.checkOutDate
      ? this.parseDate(updateBookingDto.checkOutDate)
      : existingBooking.checkOutDate;
    const status = updateBookingDto.status ?? existingBooking.status;

    this.validateDateRange(checkInDate, checkOutDate);

    const [guest, room] = await Promise.all([
      this.findGuest(guestId),
      this.findActiveRoom(roomId),
    ]);

    await this.ensureRoomCanBeBooked(room, checkInDate, checkOutDate, id);

    const acPricePerNight = await this.fetchAcPricePerNight();
    const { roomPriceTotal, coolingPrice, totalPrice } = this.calculatePricing(
      checkInDate,
      checkOutDate,
      room.pricePerNight,
      coolingOption,
      acPricePerNight,
    );

    const booking = await this.prisma.$transaction(async (tx) => {
      if (status === BookingStatus.CONFIRMED) {
        await tx.room.update({
          where: { id: room.id },
          data: { status: RoomStatus.BOOKED },
        });
      }

      return tx.booking.update({
        where: { id },
        data: {
          guestId: guest.id,
          roomId: room.id,
          checkInDate,
          checkOutDate,
          coolingOption,
          roomPriceTotal,
          coolingPrice,
          totalPrice,
          status,
        },
        include: this.bookingInclude,
      });
    });

    return this.serializeBooking(booking);
  }

  async remove(id: string) {
    await this.findBookingById(id);

    try {
      const booking = await this.prisma.booking.delete({
        where: { id },
        include: this.bookingInclude,
      });

      return this.serializeBooking(booking);
    } catch (error) {
      this.handlePrismaError(error);
    }
  }

  private async findBookingById(id: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id },
      include: this.bookingInclude,
    });

    if (!booking) {
      throw new NotFoundException(translateError('bookingNotFound'));
    }

    return booking;
  }

  private async findGuest(id: string) {
    const guest = await this.prisma.guest.findUnique({
      where: { id },
    });

    if (!guest) {
      throw new NotFoundException(translateError('guestNotFound'));
    }

    return guest;
  }

  private async findActiveRoom(id: string) {
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

  private async ensureRoomCanBeBooked(
    room: RoomEntity,
    checkInDate: Date,
    checkOutDate: Date,
    excludeBookingId?: string,
  ) {
    if (
      room.status === RoomStatus.MAINTENANCE ||
      room.status === RoomStatus.NEEDS_CLEANING ||
      room.status === RoomStatus.CLEANING_IN_PROGRESS
    ) {
      throw new ConflictException(translateError('cannotBookMaintenanceRoom'));
    }

    const overlappingBooking = await this.prisma.booking.findFirst({
      where: {
        id: excludeBookingId ? { not: excludeBookingId } : undefined,
        roomId: room.id,
        status: {
          not: BookingStatus.CANCELLED,
        },
        checkInDate: {
          lt: checkOutDate,
        },
        checkOutDate: {
          gt: checkInDate,
        },
      },
      include: {
        guest: {
          select: {
            fullName: true,
          },
        },
      },
    });

    if (overlappingBooking) {
      throw new ConflictException({
        message: translateError('bookingOverlapDetected'),
        code: 'BOOKING_CONFLICT',
        conflict: {
          roomId: room.id,
          roomNumber: room.roomNumber,
          existingBookingId: overlappingBooking.id,
          guestName: overlappingBooking.guest.fullName,
          checkInDate: this.formatDateOnly(overlappingBooking.checkInDate),
          checkOutDate: this.formatDateOnly(overlappingBooking.checkOutDate),
          status: overlappingBooking.status,
        },
      });
    }
  }

  private validateDateRange(checkInDate: Date, checkOutDate: Date) {
    if (checkOutDate <= checkInDate) {
      throw new BadRequestException(translateError('checkOutAfterCheckIn'));
    }
  }

  async checkConflict(
    roomId: string,
    checkInDateStr: string,
    checkOutDateStr: string,
    excludeBookingId?: string,
  ) {
    const checkInDate = this.parseDate(checkInDateStr);
    const checkOutDate = this.parseDate(checkOutDateStr);

    this.validateDateRange(checkInDate, checkOutDate);

    const room = await this.findActiveRoom(roomId);

    if (
      room.status === RoomStatus.MAINTENANCE ||
      room.status === RoomStatus.NEEDS_CLEANING ||
      room.status === RoomStatus.CLEANING_IN_PROGRESS
    ) {
      throw new ConflictException(translateError('cannotBookMaintenanceRoom'));
    }

    const overlappingBooking = await this.prisma.booking.findFirst({
      where: {
        id: excludeBookingId ? { not: excludeBookingId } : undefined,
        roomId: room.id,
        status: {
          not: BookingStatus.CANCELLED,
        },
        checkInDate: {
          lt: checkOutDate,
        },
        checkOutDate: {
          gt: checkInDate,
        },
      },
      include: {
        guest: {
          select: {
            fullName: true,
          },
        },
      },
    });

    if (overlappingBooking) {
      return {
        conflict: {
          roomId: room.id,
          roomNumber: room.roomNumber,
          existingBookingId: overlappingBooking.id,
          guestName: overlappingBooking.guest.fullName,
          checkInDate: this.formatDateOnly(overlappingBooking.checkInDate),
          checkOutDate: this.formatDateOnly(overlappingBooking.checkOutDate),
          status: overlappingBooking.status,
        },
      };
    }

    return { conflict: null };
  }

  private parseDate(value: string) {
    return new Date(value);
  }

  private async fetchAcPricePerNight(): Promise<Prisma.Decimal> {
    const setting = await this.settingsService.findOne(
      'airConditionerPricePerNight',
    );
    return new Prisma.Decimal(setting.value);
  }

  private calculatePricing(
    checkInDate: Date,
    checkOutDate: Date,
    pricePerNight: Prisma.Decimal,
    coolingOption: CoolingOption,
    acPricePerNight: Prisma.Decimal,
  ) {
    const millisecondsPerNight = 24 * 60 * 60 * 1000;
    const nights = Math.ceil(
      (checkOutDate.getTime() - checkInDate.getTime()) / millisecondsPerNight,
    );
    const roomPriceTotal = new Prisma.Decimal(Number(pricePerNight) * nights);
    const coolingPrice =
      coolingOption === CoolingOption.AIR_CONDITIONER
        ? new Prisma.Decimal(Number(acPricePerNight) * nights)
        : new Prisma.Decimal(0);
    const totalPrice = new Prisma.Decimal(
      Number(roomPriceTotal) + Number(coolingPrice),
    );

    return { roomPriceTotal, coolingPrice, totalPrice };
  }

  private formatDateOnly(date: Date) {
    return date.toISOString().slice(0, 10);
  }

  private isBookingStatus(status: string): status is BookingStatus {
    return Object.values(BookingStatus).includes(status as BookingStatus);
  }

  private handlePrismaError(error: unknown): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2025'
    ) {
      throw new NotFoundException(translateError('bookingNotFound'));
    }

    throw error;
  }

  private async serializeBooking(booking: BookingWithRelations) {
    const [miniBarTotal, paidAmount] = await Promise.all([
      getMiniBarTotalForBooking(this.prisma, booking.id),
      getPaidAmountForBooking(this.prisma, booking.id),
    ]);

    return this.buildBookingResponse(booking, miniBarTotal, paidAmount);
  }

  private async serializeBookingsList(bookings: BookingWithRelations[]) {
    const bookingIds = bookings.map((booking) => booking.id);
    const [miniBarTotals, paidAmounts] = await Promise.all([
      getMiniBarTotalsByBookingIds(this.prisma, bookingIds),
      getPaidAmountsByBookingIds(this.prisma, bookingIds),
    ]);

    return bookings.map((booking) =>
      this.buildBookingResponse(
        booking,
        miniBarTotals.get(booking.id) ?? new Prisma.Decimal(0),
        paidAmounts.get(booking.id) ?? new Prisma.Decimal(0),
      ),
    );
  }

  /**
   * booking.totalPrice in the DB is room + cooling only; the API response's
   * totalPrice additionally folds in CHARGED mini bar consumptions, computed
   * live so it can never drift from refunds/charges.
   */
  private buildBookingResponse(
    booking: BookingWithRelations,
    miniBarTotal: Prisma.Decimal,
    paidAmount: Prisma.Decimal,
  ) {
    const totalPrice = computeTotalPrice(
      booking.roomPriceTotal,
      booking.coolingPrice,
      miniBarTotal,
    );
    const balanceDue = computeBalanceDue(totalPrice, paidAmount);

    return {
      ...booking,
      roomPriceTotal: Number(booking.roomPriceTotal),
      coolingPrice: Number(booking.coolingPrice),
      miniBarTotal: Number(miniBarTotal),
      totalPrice: Number(totalPrice),
      paidAmount: Number(paidAmount),
      balanceDue: Number(balanceDue),
      room: {
        ...booking.room,
        pricePerNight: Number(booking.room.pricePerNight),
      },
    };
  }
}
