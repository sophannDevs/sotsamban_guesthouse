import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';

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

  async create(createGuestDto: CreateGuestDto) {
    return this.prisma.guest.create({
      data: createGuestDto,
    });
  }

  async findAll(query: PaginationQuery) {
    const pagination = getPaginationOptions(query, {
      allowedSortBy: guestSortFields,
      defaultSortBy: 'createdAt',
    });
    const where: Prisma.GuestWhereInput = pagination.search
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
      : {};

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

  async findOne(id: string) {
    return this.findGuestById(id);
  }

  async update(id: string, updateGuestDto: UpdateGuestDto) {
    await this.findGuestById(id);

    try {
      return await this.prisma.guest.update({
        where: { id },
        data: updateGuestDto,
      });
    } catch (error) {
      this.handlePrismaError(error);
    }
  }

  async remove(id: string) {
    await this.findGuestById(id);

    try {
      return await this.prisma.guest.delete({
        where: { id },
      });
    } catch (error) {
      this.handlePrismaError(error);
    }
  }

  private async findGuestById(id: string) {
    const guest = await this.prisma.guest.findUnique({
      where: { id },
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
