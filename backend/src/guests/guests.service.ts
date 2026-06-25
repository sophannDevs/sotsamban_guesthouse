import { Injectable, NotFoundException } from '@nestjs/common';
import { BookingStatus, Prisma } from '../../generated/prisma/client';

import type { AuthUser } from '../auth/types';
import { assertGuesthouseAccess } from '../common/business-access';
import { translateError } from '../common/i18n';
import {
  createPaginatedResult,
  getPaginationOptions,
  PaginationQuery,
} from '../common/pagination';
import { PrismaService } from '../prisma/prisma.service';
import { CreateGuestDto } from './dto/create-guest.dto';
import { UpdateGuestDto } from './dto/update-guest.dto';

const guestSortFields = [
  'createdAt',
  'updatedAt',
  'fullName',
  'email',
  'phone',
] as const;

@Injectable()
export class GuestsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    businessId: string,
    currentUser: AuthUser,
    createGuestDto: CreateGuestDto,
  ) {
    await assertGuesthouseAccess(
      this.prisma,
      businessId,
      currentUser.userId,
      currentUser.role,
    );

    return this.prisma.guest.create({
      data: { ...createGuestDto, businessId },
    });
  }

  async findAll(
    businessId: string,
    currentUser: AuthUser,
    query: PaginationQuery,
  ) {
    await assertGuesthouseAccess(
      this.prisma,
      businessId,
      currentUser.userId,
      currentUser.role,
    );

    const pagination = getPaginationOptions(query, {
      allowedSortBy: guestSortFields,
      defaultSortBy: 'createdAt',
    });
    const where: Prisma.GuestWhereInput = {
      businessId,
      ...(pagination.search
        ? {
            OR: [
              {
                fullName: {
                  contains: pagination.search,
                  mode: 'insensitive',
                },
              },
              {
                phone: {
                  contains: pagination.search,
                  mode: 'insensitive',
                },
              },
              {
                email: {
                  contains: pagination.search,
                  mode: 'insensitive',
                },
              },
            ],
          }
        : {}),
    };

    const [guests, total] = await Promise.all([
      this.prisma.guest.findMany({
        where,
        orderBy: {
          [pagination.sortBy]: pagination.sortOrder,
        },
        skip: pagination.skip,
        take: pagination.limit,
      }),
      this.prisma.guest.count({ where }),
    ]);

    return createPaginatedResult(guests, total, pagination);
  }

  async findOne(id: string, businessId: string, currentUser: AuthUser) {
    await assertGuesthouseAccess(
      this.prisma,
      businessId,
      currentUser.userId,
      currentUser.role,
    );

    return this.findGuestById(id, businessId);
  }

  /**
   * Fast repeat-guest lookup, backed by the @@unique([businessId, phone])
   * index — a single indexed read instead of a table scan. Returns null
   * when the guest has no phone on file or hasn't booked with this
   * business before.
   */
  async findByPhone(businessId: string, phone: string) {
    return this.prisma.guest.findUnique({
      where: { businessId_phone: { businessId, phone } },
    });
  }

  /**
   * Fast, business-scoped guest search by name or phone for debounced
   * frontend lookups (e.g. Express Check-in's guest picker). Two indexed
   * queries total regardless of result size: one bounded `findMany` (using
   * the businessId index to narrow rows before the name/phone match), then
   * a single `groupBy` to batch-compute visit stats for the matched guests
   * instead of querying bookings once per guest.
   */
  async search(
    businessId: string,
    currentUser: AuthUser,
    query: string,
    limit?: number,
  ) {
    await assertGuesthouseAccess(
      this.prisma,
      businessId,
      currentUser.userId,
      currentUser.role,
    );

    const trimmed = query?.trim();
    if (!trimmed) return [];

    const take = Math.min(Math.max(limit ?? 10, 1), 20);

    const guests = await this.prisma.guest.findMany({
      where: {
        businessId,
        OR: [
          { fullName: { contains: trimmed, mode: 'insensitive' } },
          { phone: { contains: trimmed, mode: 'insensitive' } },
        ],
      },
      select: { id: true, fullName: true, phone: true },
      orderBy: { fullName: 'asc' },
      take,
    });

    if (guests.length === 0) return [];

    const stats = await this.prisma.booking.groupBy({
      by: ['guestId'],
      where: {
        guestId: { in: guests.map((guest) => guest.id) },
        status: BookingStatus.CHECKED_OUT,
      },
      _count: { _all: true },
      _max: { checkOutDate: true },
    });
    const statsByGuestId = new Map(stats.map((stat) => [stat.guestId, stat]));

    return guests.map((guest) => {
      const stat = statsByGuestId.get(guest.id);

      return {
        id: guest.id,
        name: guest.fullName,
        phone: guest.phone,
        lastBookingDate: stat?._max.checkOutDate ?? null,
        totalVisits: stat?._count._all ?? 0,
      };
    });
  }

  /**
   * Top repeat guests for this business, ranked by completed-stay count —
   * powers the dashboard's "Frequent Guests" widget for one-click re-check-in.
   * Same two-query batching as `search`: bound the guest set by businessId
   * first, then a single `groupBy` ranks them by visit count instead of
   * querying bookings once per guest.
   */
  async getFrequent(businessId: string, currentUser: AuthUser, limit?: number) {
    await assertGuesthouseAccess(
      this.prisma,
      businessId,
      currentUser.userId,
      currentUser.role,
    );

    const take = Math.min(Math.max(limit ?? 5, 1), 20);

    const guests = await this.prisma.guest.findMany({
      where: { businessId },
      select: { id: true, fullName: true, phone: true },
    });

    if (guests.length === 0) return [];

    const stats = await this.prisma.booking.groupBy({
      by: ['guestId'],
      where: {
        guestId: { in: guests.map((guest) => guest.id) },
        status: BookingStatus.CHECKED_OUT,
      },
      _count: { _all: true },
      _max: { checkOutDate: true },
      orderBy: { _count: { guestId: 'desc' } },
      take,
    });

    const guestsById = new Map(guests.map((guest) => [guest.id, guest]));

    return stats
      .filter((stat) => guestsById.has(stat.guestId))
      .map((stat) => {
        const guest = guestsById.get(stat.guestId)!;

        return {
          id: guest.id,
          name: guest.fullName,
          phone: guest.phone,
          lastBookingDate: stat._max.checkOutDate,
          totalVisits: stat._count._all,
        };
      });
  }

  async update(
    id: string,
    businessId: string,
    currentUser: AuthUser,
    updateGuestDto: UpdateGuestDto,
  ) {
    await assertGuesthouseAccess(
      this.prisma,
      businessId,
      currentUser.userId,
      currentUser.role,
    );
    await this.findGuestById(id, businessId);

    try {
      return await this.prisma.guest.update({
        where: { id },
        data: updateGuestDto,
      });
    } catch (error) {
      this.handlePrismaError(error);
    }
  }

  async remove(id: string, businessId: string, currentUser: AuthUser) {
    await assertGuesthouseAccess(
      this.prisma,
      businessId,
      currentUser.userId,
      currentUser.role,
    );
    await this.findGuestById(id, businessId);

    try {
      return await this.prisma.guest.delete({
        where: { id },
      });
    } catch (error) {
      this.handlePrismaError(error);
    }
  }

  private async findGuestById(id: string, businessId: string) {
    const guest = await this.prisma.guest.findFirst({
      where: { id, businessId },
    });

    if (!guest) {
      throw new NotFoundException(translateError('guestNotFound'));
    }

    return guest;
  }

  private handlePrismaError(error: unknown): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2025'
    ) {
      throw new NotFoundException(translateError('guestNotFound'));
    }

    throw error;
  }
}
