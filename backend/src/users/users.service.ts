import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { Prisma, User } from '../../generated/prisma/client';
import {
  createPaginatedResult,
  getPaginationOptions,
  PaginationQuery,
} from '../common/pagination';
import { PrismaService } from '../prisma/prisma.service';
import { UpdatePreferencesDto } from './dto/update-preferences.dto';
import { UpdateUserDto } from './dto/update-user.dto';

const userSortFields = [
  'createdAt',
  'updatedAt',
  'name',
  'email',
  'role',
] as const;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: PaginationQuery) {
    const pagination = getPaginationOptions(query, {
      allowedSortBy: userSortFields,
      defaultSortBy: 'createdAt',
    });
    const where: Prisma.UserWhereInput = pagination.search
      ? {
          OR: [
            {
              name: {
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

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        orderBy: {
          [pagination.sortBy]: pagination.sortOrder,
        },
        skip: pagination.skip,
        take: pagination.limit,
      }),
      this.prisma.user.count({ where }),
    ]);

    return createPaginatedResult(
      users.map((user) => this.serializeUser(user)),
      total,
      pagination,
    );
  }

  async findOne(id: string) {
    const user = await this.findUserById(id);

    return this.serializeUser(user);
  }

  async update(id: string, updateUserDto: UpdateUserDto) {
    await this.findUserById(id);

    try {
      const user = await this.prisma.user.update({
        where: { id },
        data: updateUserDto,
      });

      return this.serializeUser(user);
    } catch (error) {
      this.handlePrismaError(error);
    }
  }

  async updatePreferences(
    id: string,
    updatePreferencesDto: UpdatePreferencesDto,
  ) {
    await this.findUserById(id);

    const user = await this.prisma.user.update({
      where: { id },
      data: updatePreferencesDto,
    });

    return this.serializeUser(user);
  }

  async remove(id: string) {
    await this.findUserById(id);

    try {
      const user = await this.prisma.user.delete({
        where: { id },
      });

      return this.serializeUser(user);
    } catch (error) {
      this.handlePrismaError(error);
    }
  }

  private async findUserById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException('User not found.');
    }

    return user;
  }

  private serializeUser(user: User) {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      preferredLanguage: user.preferredLanguage,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  private handlePrismaError(error: unknown): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        throw new ConflictException('Email already exists.');
      }

      if (error.code === 'P2025') {
        throw new NotFoundException('User not found.');
      }
    }

    throw error;
  }
}
