import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  BookingSource,
  BookingStatus,
  BookingType,
  CoolingOption,
  HousekeepingPriority,
  HousekeepingStatus,
  Prisma,
  RoomStatus,
  SessionType,
  StayDuration,
  UserRole,
} from '../../generated/prisma/client';

import {
  computeBalanceDue,
  computeTotalPrice,
  getMiniBarTotalForBooking,
  getMiniBarTotalsByBookingIds,
  getPaidAmountForBooking,
  getPaidAmountsByBookingIds,
} from '../common/booking-totals';
import { assertGuesthouseAccess } from '../common/business-access';
import { translateError } from '../common/i18n';
import {
  createPaginatedResult,
  getPaginationOptions,
  PaginationQuery,
} from '../common/pagination';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PricingService } from '../pricing/pricing.service';
import { SettingsService } from '../settings/settings.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import {
  CreateHourlyBookingDto,
  PreviewHourlyBookingPriceDto,
} from './dto/create-hourly-booking.dto';
import { ExpressCheckInDto } from './dto/express-check-in.dto';
import { UpdateBookingDto } from './dto/update-booking.dto';
import { WalkInCheckInDto } from './dto/walk-in-check-in.dto';

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

const stayDurationHours: Record<StayDuration, number> = {
  [StayDuration.TWO_HOURS]: 2,
  [StayDuration.THREE_HOURS]: 3,
  [StayDuration.SIX_HOURS]: 6,
  [StayDuration.TWELVE_HOURS]: 12,
  [StayDuration.TWENTY_FOUR_HOURS]: 24,
};

type BookingScheduleInput = {
  bookingType?: BookingType;
  stayDuration?: StayDuration;
  sessionType?: SessionType;
  checkInDate?: string;
  checkOutDate?: string;
  checkInTime?: string;
};

type ExistingBookingSchedule = Pick<
  BookingWithRelations,
  | 'bookingType'
  | 'stayDuration'
  | 'sessionType'
  | 'checkInDate'
  | 'checkOutDate'
  | 'checkInTime'
>;

@Injectable()
export class BookingsService {
  private readonly bookingInclude = {
    guest: true,
    room: true,
  } satisfies Prisma.BookingInclude;

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
    private readonly pricingService: PricingService,
    private readonly settingsService: SettingsService,
  ) {}

  async create(createBookingDto: CreateBookingDto, actorUserId?: string) {
    const status = createBookingDto.status ?? BookingStatus.PENDING;
    const coolingOption = createBookingDto.coolingOption ?? CoolingOption.FAN;
    const schedule = this.normalizeBookingSchedule(createBookingDto);

    const [guest, room] = await Promise.all([
      this.findGuest(createBookingDto.guestId),
      this.findActiveRoom(createBookingDto.roomId),
    ]);

    await this.ensureRoomCanBeBooked(
      room,
      schedule.checkInDate,
      schedule.checkOutDate,
    );

    const acPricePerNight = await this.fetchAcPricePerNight();
    const {
      basePrice,
      durationPrice,
      sessionPrice,
      roomPriceTotal,
      coolingPrice,
      totalPrice,
    } = this.calculatePricing(
      schedule.checkInDate,
      schedule.checkOutDate,
      room.pricePerNight,
      schedule,
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
          ...schedule,
          coolingOption,
          basePrice,
          durationPrice,
          sessionPrice,
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

  async findAll(
    query: PaginationQuery & {
      status?: BookingStatus;
      source?: BookingSource;
      bookingType?: BookingType;
    },
  ) {
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

    if (query.source && !Object.values(BookingSource).includes(query.source)) {
      throw new BadRequestException(
        `source must be one of the following values: ${Object.values(
          BookingSource,
        ).join(', ')}`,
      );
    }

    if (
      query.bookingType &&
      !Object.values(BookingType).includes(query.bookingType)
    ) {
      throw new BadRequestException(
        `bookingType must be one of the following values: ${Object.values(
          BookingType,
        ).join(', ')}`,
      );
    }

    const where: Prisma.BookingWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.source ? { source: query.source } : {}),
      ...(query.bookingType ? { bookingType: query.bookingType } : {}),
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

  async checkIn(
    id: string,
    businessId: string,
    userId: string,
    userRole: UserRole,
  ) {
    await assertGuesthouseAccess(this.prisma, businessId, userId, userRole);

    const existingBooking = await this.findBookingById(id);

    if (existingBooking.status !== BookingStatus.CONFIRMED) {
      throw new ConflictException(
        translateError('onlyConfirmedBookingsCanCheckIn'),
      );
    }

    // Defensive re-check: the room may have gone into maintenance, or another
    // booking may have been created for the same dates, since this booking
    // was originally confirmed.
    await this.ensureRoomCanBeBooked(
      existingBooking.room,
      existingBooking.checkInDate,
      existingBooking.checkOutDate,
      id,
    );

    const booking = await this.prisma.$transaction(async (tx) => {
      await tx.room.update({
        where: { id: existingBooking.roomId },
        data: { status: RoomStatus.OCCUPIED },
      });

      return tx.booking.update({
        where: { id },
        data: { status: BookingStatus.CHECKED_IN, checkInAt: new Date() },
        include: this.bookingInclude,
      });
    });

    await this.notificationsService.notifyBookingCheckedIn(userId, booking.id);

    return this.serializeBooking(booking);
  }

  async checkOut(
    id: string,
    businessId: string,
    userId: string,
    userRole: UserRole,
  ) {
    const business = await assertGuesthouseAccess(
      this.prisma,
      businessId,
      userId,
      userRole,
    );

    const existingBooking = await this.findBookingById(id);

    if (existingBooking.status !== BookingStatus.CHECKED_IN) {
      throw new ConflictException(
        translateError('onlyCheckedInBookingsCanCheckOut'),
      );
    }

    const booking = await this.prisma.$transaction(async (tx) => {
      await tx.room.update({
        where: { id: existingBooking.roomId },
        data: { status: RoomStatus.NEEDS_CLEANING },
      });

      const updatedBooking = await tx.booking.update({
        where: { id },
        data: { status: BookingStatus.CHECKED_OUT, checkOutAt: new Date() },
        include: this.bookingInclude,
      });

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
            businessId: business.id,
            roomId: existingBooking.roomId,
            bookingId: id,
            status: HousekeepingStatus.NEEDS_CLEANING,
            priority: HousekeepingPriority.MEDIUM,
            note: 'Room needs cleaning after check-out',
          },
        });
      }

      return updatedBooking;
    });

    await this.notificationsService.notifyBookingCheckedOut(userId, booking.id);

    return this.serializeBooking(booking);
  }

  async walkInCheckIn(
    userId: string,
    userRole: UserRole,
    businessId: string,
    dto: WalkInCheckInDto,
  ) {
    await assertGuesthouseAccess(this.prisma, businessId, userId, userRole);

    const schedule = this.normalizeBookingSchedule(dto, undefined, {
      defaultDailyCheckout: true,
    });

    const room = await this.findActiveRoom(dto.roomId);

    // Respect the same conflict rules as regular bookings
    await this.ensureRoomCanBeBooked(
      room,
      schedule.checkInDate,
      schedule.checkOutDate,
    );

    const coolingOption = dto.coolingOption ?? CoolingOption.FAN;
    const acPricePerNight = await this.fetchAcPricePerNight();
    const {
      basePrice,
      durationPrice,
      sessionPrice,
      roomPriceTotal,
      coolingPrice,
      totalPrice,
    } = this.calculatePricing(
      schedule.checkInDate,
      schedule.checkOutDate,
      room.pricePerNight,
      schedule,
      coolingOption,
      acPricePerNight,
    );

    // Attempt guest lookup before the transaction (read-only, keeps tx short).
    // Scoped to this business and backed by the @@unique([businessId, phone])
    // index — a single indexed read, not a table scan.
    let existingGuestId: string | null = null;
    if (dto.guest.phone) {
      const found = await this.prisma.guest.findUnique({
        where: {
          businessId_phone: { businessId, phone: dto.guest.phone },
        },
        select: { id: true },
      });
      existingGuestId = found?.id ?? null;
    }

    const booking = await this.prisma.$transaction(async (tx) => {
      // Reuse existing guest or create inline — atomic with the booking
      const guestId =
        existingGuestId ??
        (
          await tx.guest.create({
            data: {
              businessId,
              fullName: dto.guest.name,
              phone: dto.guest.phone,
            },
            select: { id: true },
          })
        ).id;

      await tx.room.update({
        where: { id: room.id },
        data: { status: RoomStatus.OCCUPIED },
      });

      return tx.booking.create({
        data: {
          guestId,
          roomId: room.id,
          ...schedule,
          checkInAt: new Date(),
          coolingOption,
          basePrice,
          durationPrice,
          sessionPrice,
          roomPriceTotal,
          coolingPrice,
          totalPrice,
          status: BookingStatus.CHECKED_IN,
          source: BookingSource.WALK_IN,
        },
        include: this.bookingInclude,
      });
    });

    await this.notificationsService.notifyBookingCheckedIn(userId, booking.id);

    return this.serializeBooking(booking);
  }

  /**
   * Fast desk check-in for a guest who already has a Guest record — skips
   * the guest-form/creation step that walkInCheckIn does, trading it for a
   * single scoped existence check. Still runs the same conflict and pricing
   * logic as every other booking-creation path.
   */
  async expressCheckIn(
    userId: string,
    userRole: UserRole,
    businessId: string,
    dto: ExpressCheckInDto,
  ) {
    await assertGuesthouseAccess(this.prisma, businessId, userId, userRole);

    const [guest, room] = await Promise.all([
      this.findGuestInBusiness(dto.guestId, businessId),
      this.findActiveRoom(dto.roomId),
    ]);

    const schedule = this.normalizeBookingSchedule(dto, undefined, {
      defaultDailyCheckout: true,
    });

    // Respect the same conflict rules as every other booking-creation path
    await this.ensureRoomCanBeBooked(
      room,
      schedule.checkInDate,
      schedule.checkOutDate,
    );

    const coolingOption = dto.coolingOption ?? CoolingOption.FAN;
    const acPricePerNight = await this.fetchAcPricePerNight();
    const {
      basePrice,
      durationPrice,
      sessionPrice,
      roomPriceTotal,
      coolingPrice,
      totalPrice,
    } = this.calculatePricing(
      schedule.checkInDate,
      schedule.checkOutDate,
      room.pricePerNight,
      schedule,
      coolingOption,
      acPricePerNight,
    );

    const booking = await this.prisma.$transaction(async (tx) => {
      await tx.room.update({
        where: { id: room.id },
        data: { status: RoomStatus.OCCUPIED },
      });

      return tx.booking.create({
        data: {
          guestId: guest.id,
          roomId: room.id,
          ...schedule,
          checkInAt: new Date(),
          coolingOption,
          basePrice,
          durationPrice,
          sessionPrice,
          roomPriceTotal,
          coolingPrice,
          totalPrice,
          status: BookingStatus.CHECKED_IN,
          // Express check-in is a desk-initiated, in-person check-in just
          // like walk-in — it only skips guest-form creation because the
          // Guest record already exists. Always WALK_IN, never ONLINE.
          source: BookingSource.WALK_IN,
        },
        include: this.bookingInclude,
      });
    });

    await this.notificationsService.notifyBookingCheckedIn(userId, booking.id);

    return this.serializeBooking(booking);
  }

  async createHourly(
    userId: string,
    userRole: UserRole,
    businessId: string,
    dto: CreateHourlyBookingDto,
  ) {
    await assertGuesthouseAccess(this.prisma, businessId, userId, userRole);

    const schedule = this.getTimedBookingSchedule(dto);

    const [guest, room] = await Promise.all([
      this.findGuestInBusiness(dto.guestId, businessId),
      this.findActiveRoom(dto.roomId),
    ]);

    await this.ensureRoomCanBeBooked(
      room,
      schedule.checkInDate,
      schedule.checkOutDate,
    );

    const acPricePerNight = await this.fetchAcPricePerNight();
    const {
      basePrice,
      durationPrice,
      sessionPrice,
      roomPriceTotal,
      coolingPrice,
      totalPrice,
    } = this.calculatePricing(
      schedule.checkInDate,
      schedule.checkOutDate,
      room.pricePerNight,
      schedule,
      dto.coolingOption,
      acPricePerNight,
    );

    try {
      const booking = await this.prisma.$transaction(
        async (tx) => {
          const currentRoom = await tx.room.findFirst({
            where: { id: room.id, deletedAt: null },
          });

          if (!currentRoom) {
            throw new NotFoundException(translateError('roomNotFound'));
          }

          if (
            currentRoom.status === RoomStatus.MAINTENANCE ||
            currentRoom.status === RoomStatus.NEEDS_CLEANING ||
            currentRoom.status === RoomStatus.CLEANING_IN_PROGRESS ||
            currentRoom.status === RoomStatus.OCCUPIED
          ) {
            throw new ConflictException(
              translateError('cannotBookMaintenanceRoom'),
            );
          }

          const overlappingBooking = await tx.booking.findFirst({
            where: {
              roomId: currentRoom.id,
              status: {
                not: BookingStatus.CANCELLED,
              },
              checkInDate: {
                lt: schedule.checkOutDate,
              },
              checkOutDate: {
                gt: schedule.checkInDate,
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
                roomId: currentRoom.id,
                roomNumber: currentRoom.roomNumber,
                existingBookingId: overlappingBooking.id,
                guestName: overlappingBooking.guest.fullName,
                checkInDate: overlappingBooking.checkInDate.toISOString(),
                checkOutDate: overlappingBooking.checkOutDate.toISOString(),
                status: overlappingBooking.status,
              },
            });
          }

          await tx.room.update({
            where: { id: currentRoom.id },
            data: { status: RoomStatus.OCCUPIED },
          });

          return tx.booking.create({
            data: {
              guestId: guest.id,
              roomId: currentRoom.id,
              ...schedule,
              checkInAt: schedule.checkInTime,
              coolingOption: dto.coolingOption,
              basePrice,
              durationPrice,
              sessionPrice,
              roomPriceTotal,
              coolingPrice,
              totalPrice,
              status: BookingStatus.CHECKED_IN,
              source: BookingSource.WALK_IN,
            },
            include: this.bookingInclude,
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );

      await this.notificationsService.notifyBookingCheckedIn(
        userId,
        booking.id,
      );

      return this.serializeBooking(booking);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2034'
      ) {
        throw new ConflictException({
          message: translateError('bookingOverlapDetected'),
          code: 'BOOKING_CONFLICT',
        });
      }

      throw error;
    }
  }

  async previewHourlyPrice(dto: PreviewHourlyBookingPriceDto) {
    const room = await this.findActiveRoom(dto.roomId);
    const schedule = this.getTimedBookingSchedule(dto);
    const acPricePerNight = await this.fetchAcPricePerNight();
    const price = this.calculatePricing(
      schedule.checkInDate,
      schedule.checkOutDate,
      room.pricePerNight,
      schedule,
      dto.coolingOption,
      acPricePerNight,
    );

    return {
      bookingType: schedule.bookingType,
      stayDuration: schedule.stayDuration,
      sessionType: schedule.sessionType,
      checkInTime: schedule.checkInTime.toISOString(),
      autoCheckoutAt: schedule.autoCheckoutAt.toISOString(),
      basePrice: Number(price.basePrice),
      durationPrice: Number(price.durationPrice),
      sessionPrice: Number(price.sessionPrice),
      roomPriceTotal: Number(price.roomPriceTotal),
      coolingPrice: Number(price.coolingPrice),
      totalPrice: Number(price.totalPrice),
    };
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
    const status = updateBookingDto.status ?? existingBooking.status;
    const schedule = this.normalizeBookingSchedule(
      updateBookingDto,
      existingBooking,
    );

    const [guest, room] = await Promise.all([
      this.findGuest(guestId),
      this.findActiveRoom(roomId),
    ]);

    await this.ensureRoomCanBeBooked(
      room,
      schedule.checkInDate,
      schedule.checkOutDate,
      id,
    );

    const acPricePerNight = await this.fetchAcPricePerNight();
    const {
      basePrice,
      durationPrice,
      sessionPrice,
      roomPriceTotal,
      coolingPrice,
      totalPrice,
    } = this.calculatePricing(
      schedule.checkInDate,
      schedule.checkOutDate,
      room.pricePerNight,
      schedule,
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
          ...schedule,
          coolingOption,
          basePrice,
          durationPrice,
          sessionPrice,
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

  private async findGuestInBusiness(id: string, businessId: string) {
    const guest = await this.prisma.guest.findFirst({
      where: { id, businessId },
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

  private getTimedBookingSchedule(
    input: Pick<
      BookingScheduleInput,
      'bookingType' | 'stayDuration' | 'sessionType'
    >,
  ) {
    const bookingType = input.bookingType ?? BookingType.HOURLY;
    const checkInTime = new Date();
    const stayDuration =
      bookingType === BookingType.DAILY
        ? StayDuration.TWENTY_FOUR_HOURS
        : bookingType === BookingType.HALF_DAY
          ? (input.stayDuration ?? StayDuration.SIX_HOURS)
          : input.stayDuration;

    if (!stayDuration) {
      throw new BadRequestException(
        'stayDuration is required for hourly bookings.',
      );
    }

    const autoCheckoutAt = new Date(
      checkInTime.getTime() + stayDurationHours[stayDuration] * 60 * 60 * 1000,
    );

    return {
      bookingType,
      stayDuration,
      sessionType: input.sessionType ?? null,
      checkInDate: checkInTime,
      checkOutDate: autoCheckoutAt,
      checkInTime,
      checkOutTime: autoCheckoutAt,
      autoCheckoutAt,
    };
  }

  private normalizeBookingSchedule(
    input: BookingScheduleInput,
    existing?: ExistingBookingSchedule,
    options: { defaultDailyCheckout?: boolean } = {},
  ) {
    const bookingType =
      input.bookingType ?? existing?.bookingType ?? BookingType.DAILY;

    if (bookingType === BookingType.DAILY) {
      const checkInDate = input.checkInDate
        ? this.parseDate(input.checkInDate)
        : existing?.checkInDate;
      const checkOutDate = input.checkOutDate
        ? this.parseDate(input.checkOutDate)
        : (existing?.checkOutDate ??
          (options.defaultDailyCheckout && checkInDate
            ? new Date(checkInDate.getTime() + 24 * 60 * 60 * 1000)
            : undefined));

      if (!checkInDate) {
        throw new BadRequestException(
          'checkInDate is required for daily bookings.',
        );
      }

      if (!checkOutDate) {
        throw new BadRequestException(
          'checkOutDate is required for daily bookings.',
        );
      }

      this.validateDateRange(checkInDate, checkOutDate);

      return {
        bookingType,
        stayDuration: null,
        sessionType: null,
        checkInDate,
        checkOutDate,
        checkInTime: null,
        checkOutTime: null,
        autoCheckoutAt: null,
      };
    }

    const checkInTime = input.checkInTime
      ? this.parseDate(input.checkInTime)
      : existing?.checkInTime;
    const stayDuration = input.stayDuration ?? existing?.stayDuration;

    if (!checkInTime) {
      throw new BadRequestException(
        'checkInTime is required for hourly bookings.',
      );
    }

    if (!stayDuration) {
      throw new BadRequestException(
        'stayDuration is required for hourly bookings.',
      );
    }

    const checkOutTime = new Date(
      checkInTime.getTime() + stayDurationHours[stayDuration] * 60 * 60 * 1000,
    );

    this.validateDateRange(checkInTime, checkOutTime);

    return {
      bookingType,
      stayDuration,
      sessionType: input.sessionType ?? existing?.sessionType ?? null,
      checkInDate: checkInTime,
      checkOutDate: checkOutTime,
      checkInTime,
      checkOutTime,
      autoCheckoutAt: checkOutTime,
    };
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
    schedule: Pick<
      ExistingBookingSchedule,
      'bookingType' | 'stayDuration' | 'sessionType'
    >,
    coolingOption: CoolingOption,
    acPricePerNight: Prisma.Decimal,
  ) {
    const millisecondsPerNight = 24 * 60 * 60 * 1000;
    const nights = Math.ceil(
      (checkOutDate.getTime() - checkInDate.getTime()) / millisecondsPerNight,
    );

    const roomPrice = this.pricingService.calculateBookingPrice({
      roomPricePerDay: pricePerNight,
      bookingType: schedule.bookingType,
      stayDuration: schedule.stayDuration,
      sessionType: schedule.sessionType,
    });
    const basePrice = roomPrice.basePrice.mul(nights);
    const durationPrice = roomPrice.durationPrice.mul(nights);
    const sessionPrice = roomPrice.sessionPrice.mul(nights);
    const roomPriceTotal = roomPrice.totalPrice.mul(nights);

    const coolingPrice =
      coolingOption === CoolingOption.AIR_CONDITIONER
        ? this.pricingService
            .calculateBookingPrice({
              roomPricePerDay: acPricePerNight,
              bookingType: schedule.bookingType,
              stayDuration: schedule.stayDuration,
              sessionType: schedule.sessionType,
            })
            .totalPrice.mul(nights)
        : new Prisma.Decimal(0);
    const totalPrice = roomPriceTotal.add(coolingPrice);

    return {
      basePrice,
      durationPrice,
      sessionPrice,
      roomPriceTotal,
      coolingPrice,
      totalPrice,
    };
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
      basePrice: Number(booking.basePrice),
      durationPrice: Number(booking.durationPrice),
      sessionPrice: Number(booking.sessionPrice),
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
