import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import {
  Business,
  BusinessType,
  Prisma,
  UserRole,
} from '../../generated/prisma/client';
import { apiResponse } from '../common/api-response';
import {
  createPaginatedResult,
  getPaginationOptions,
  PaginationQuery,
} from '../common/pagination';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

const categorySortFields = ['createdAt', 'updatedAt', 'name'] as const;

type CategoryWithCount = Prisma.ProductCategoryGetPayload<{
  include: { _count: { select: { products: true } } };
}>;

@Injectable()
export class StoreCategoryService {
  constructor(private readonly prisma: PrismaService) {}

  private readonly categoryInclude = {
    _count: { select: { products: { where: { deletedAt: null } } } },
  } satisfies Prisma.ProductCategoryInclude;

  async create(
    dto: CreateCategoryDto,
    businessId: string,
    userId: string,
    userRole: UserRole,
  ) {
    await this.validateStoreAccess(businessId, userId, userRole);

    const category = await this.prisma.productCategory.create({
      data: { name: dto.name, description: dto.description, businessId },
      include: this.categoryInclude,
    });

    return apiResponse('Category created.', this.serialize(category));
  }

  async findAll(
    businessId: string,
    query: PaginationQuery,
    userId: string,
    userRole: UserRole,
  ) {
    await this.validateStoreAccess(businessId, userId, userRole);

    const pagination = getPaginationOptions(query, {
      allowedSortBy: categorySortFields,
      defaultSortBy: 'createdAt',
    });

    const where: Prisma.ProductCategoryWhereInput = {
      businessId,
      deletedAt: null,
      ...(pagination.search
        ? { name: { contains: pagination.search, mode: 'insensitive' } }
        : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.productCategory.findMany({
        where,
        include: this.categoryInclude,
        orderBy: { [pagination.sortBy]: pagination.sortOrder },
        skip: pagination.skip,
        take: pagination.limit,
      }),
      this.prisma.productCategory.count({ where }),
    ]);

    return createPaginatedResult(
      data.map((c) => this.serialize(c)),
      total,
      pagination,
    );
  }

  async findOne(
    id: string,
    businessId: string,
    userId: string,
    userRole: UserRole,
  ) {
    await this.validateStoreAccess(businessId, userId, userRole);

    const category = await this.prisma.productCategory.findFirst({
      where: { id, businessId, deletedAt: null },
      include: this.categoryInclude,
    });

    if (!category) {
      throw new NotFoundException('Category not found.');
    }

    return apiResponse('Category found.', this.serialize(category));
  }

  async update(
    id: string,
    dto: UpdateCategoryDto,
    businessId: string,
    userId: string,
    userRole: UserRole,
  ) {
    await this.validateStoreAccess(businessId, userId, userRole);

    const existing = await this.prisma.productCategory.findFirst({
      where: { id, businessId, deletedAt: null },
    });

    if (!existing) {
      throw new NotFoundException('Category not found.');
    }

    const updated = await this.prisma.productCategory.update({
      where: { id },
      data: { name: dto.name, description: dto.description },
      include: this.categoryInclude,
    });

    return apiResponse('Category updated.', this.serialize(updated));
  }

  async remove(
    id: string,
    businessId: string,
    userId: string,
    userRole: UserRole,
  ) {
    await this.validateStoreAccess(businessId, userId, userRole);

    const existing = await this.prisma.productCategory.findFirst({
      where: { id, businessId, deletedAt: null },
    });

    if (!existing) {
      throw new NotFoundException('Category not found.');
    }

    await this.prisma.productCategory.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    return apiResponse('Category deleted.', null);
  }

  async validateStoreAccess(
    businessId: string,
    userId: string,
    userRole: UserRole,
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

    if (business.type !== BusinessType.STORE) {
      throw new ForbiddenException(
        'This endpoint is only available for STORE businesses.',
      );
    }

    if (userRole !== UserRole.ADMIN) {
      const member = await this.prisma.businessMember.findUnique({
        where: { businessId_userId: { businessId, userId } },
      });

      if (!member) {
        throw new ForbiddenException('You are not a member of this business.');
      }
    }

    return business;
  }

  private serialize(category: CategoryWithCount) {
    return {
      id: category.id,
      businessId: category.businessId,
      name: category.name,
      description: category.description,
      productCount: category._count.products,
      createdAt: category.createdAt,
      updatedAt: category.updatedAt,
      deletedAt: category.deletedAt,
    };
  }
}
