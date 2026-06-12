import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import {
  BusinessRole,
  Prisma,
  UserRole,
} from '../../generated/prisma/client';
import {
  createPaginatedResult,
  getPaginationOptions,
  PaginationQuery,
} from '../common/pagination';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBusinessDto } from './dto/create-business.dto';
import { UpdateBusinessDto } from './dto/update-business.dto';

const businessSortFields = ['createdAt', 'updatedAt', 'name'] as const;

type BusinessWithRelations = Prisma.BusinessGetPayload<{
  include: {
    owner: { select: { id: true; name: true; email: true } };
    _count: { select: { members: true } };
  };
}>;

@Injectable()
export class BusinessService {
  constructor(private readonly prisma: PrismaService) {}

  private readonly businessInclude = {
    owner: { select: { id: true, name: true, email: true } },
    _count: { select: { members: true } },
  } satisfies Prisma.BusinessInclude;

  async create(dto: CreateBusinessDto, userId: string) {
    const business = await this.prisma.$transaction(async (tx) => {
      const created = await tx.business.create({
        data: { name: dto.name, type: dto.type, ownerId: userId },
      });

      await tx.businessMember.create({
        data: { businessId: created.id, userId, role: BusinessRole.OWNER },
      });

      return tx.business.findUniqueOrThrow({
        where: { id: created.id },
        include: this.businessInclude,
      });
    });

    return this.serializeBusiness(business);
  }

  async findAll(query: PaginationQuery, userId: string, userRole: UserRole) {
    const pagination = getPaginationOptions(query, {
      allowedSortBy: businessSortFields,
      defaultSortBy: 'createdAt',
    });

    const memberFilter: Prisma.BusinessWhereInput =
      userRole === UserRole.ADMIN ? {} : { members: { some: { userId } } };

    const where: Prisma.BusinessWhereInput = pagination.search
      ? {
          AND: [
            memberFilter,
            { name: { contains: pagination.search, mode: 'insensitive' } },
          ],
        }
      : memberFilter;

    const [data, total] = await Promise.all([
      this.prisma.business.findMany({
        where,
        include: this.businessInclude,
        orderBy: { [pagination.sortBy]: pagination.sortOrder },
        skip: pagination.skip,
        take: pagination.limit,
      }),
      this.prisma.business.count({ where }),
    ]);

    return createPaginatedResult(
      data.map((b) => this.serializeBusiness(b)),
      total,
      pagination,
    );
  }

  async findOne(id: string, userId: string, userRole: UserRole) {
    const where: Prisma.BusinessWhereInput =
      userRole === UserRole.ADMIN
        ? { id }
        : { id, members: { some: { userId } } };

    const business = await this.prisma.business.findFirst({
      where,
      include: this.businessInclude,
    });

    if (!business) {
      throw new NotFoundException('Business not found.');
    }

    return this.serializeBusiness(business);
  }

  async update(id: string, dto: UpdateBusinessDto, userId: string) {
    const business = await this.findBusinessById(id);
    this.assertOwner(business, userId);

    const updated = await this.prisma.business.update({
      where: { id },
      data: dto,
      include: this.businessInclude,
    });

    return this.serializeBusiness(updated);
  }

  async remove(id: string, userId: string) {
    const business = await this.findBusinessById(id);
    this.assertOwner(business, userId);

    const deleted = await this.prisma.business.delete({
      where: { id },
      include: this.businessInclude,
    });

    return this.serializeBusiness(deleted);
  }

  private async findBusinessById(id: string) {
    const business = await this.prisma.business.findUnique({
      where: { id },
      include: this.businessInclude,
    });

    if (!business) {
      throw new NotFoundException('Business not found.');
    }

    return business;
  }

  private assertOwner(business: BusinessWithRelations, userId: string) {
    if (business.ownerId !== userId) {
      throw new ForbiddenException(
        'Only the business owner can perform this action.',
      );
    }
  }

  async switchTo(businessId: string, userId: string, userRole: UserRole) {
    const business = await this.prisma.business.findUnique({
      where: { id: businessId },
    });

    if (!business) {
      throw new NotFoundException('Business not found.');
    }

    if (userRole !== UserRole.ADMIN) {
      const membership = await this.prisma.businessMember.findUnique({
        where: { businessId_userId: { businessId, userId } },
      });

      if (!membership) {
        throw new ForbiddenException('You are not a member of this business.');
      }
    }

    return {
      businessId: business.id,
      businessName: business.name,
      businessType: business.type,
    };
  }

  private serializeBusiness(business: BusinessWithRelations) {
    return {
      id: business.id,
      name: business.name,
      type: business.type,
      ownerId: business.ownerId,
      owner: business.owner,
      memberCount: business._count.members,
      createdAt: business.createdAt,
      updatedAt: business.updatedAt,
    };
  }
}
