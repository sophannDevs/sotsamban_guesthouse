import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { Prisma, UserRole } from '../../generated/prisma/client';
import { apiResponse } from '../common/api-response';
import {
  createPaginatedResult,
  getPaginationOptions,
  PaginationQuery,
} from '../common/pagination';
import { PrismaService } from '../prisma/prisma.service';
import { StoreCategoryService } from './store-category.service';
import { CreateSupplierDto } from './dto/create-supplier.dto';

export type SupplierPaginationQuery = PaginationQuery;

const supplierSortFields = ['name', 'createdAt', 'updatedAt'] as const;

@Injectable()
export class StoreSupplierService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly categoryService: StoreCategoryService,
  ) {}

  async create(
    dto: CreateSupplierDto,
    businessId: string,
    userId: string,
    userRole: UserRole,
  ) {
    await this.categoryService.validateStoreAccess(businessId, userId, userRole);

    const supplier = await this.prisma.supplier.create({
      data: {
        businessId,
        name: dto.name,
        phone: dto.phone ?? null,
        email: dto.email ?? null,
        address: dto.address ?? null,
      },
    });

    return apiResponse('Supplier created.', this.serialize(supplier));
  }

  async findAll(
    businessId: string,
    query: SupplierPaginationQuery,
    userId: string,
    userRole: UserRole,
  ) {
    await this.categoryService.validateStoreAccess(businessId, userId, userRole);

    const pagination = getPaginationOptions(query, {
      allowedSortBy: supplierSortFields,
      defaultSortBy: 'name',
    });

    const where: Prisma.SupplierWhereInput = {
      businessId,
      ...(pagination.search
        ? {
            OR: [
              {
                name: {
                  contains: pagination.search,
                  mode: 'insensitive' as const,
                },
              },
              {
                phone: {
                  contains: pagination.search,
                  mode: 'insensitive' as const,
                },
              },
              {
                email: {
                  contains: pagination.search,
                  mode: 'insensitive' as const,
                },
              },
            ],
          }
        : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.supplier.findMany({
        where,
        orderBy: { [pagination.sortBy]: pagination.sortOrder },
        skip: pagination.skip,
        take: pagination.limit,
      }),
      this.prisma.supplier.count({ where }),
    ]);

    return createPaginatedResult(
      data.map((s) => this.serialize(s)),
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
    await this.categoryService.validateStoreAccess(businessId, userId, userRole);

    const supplier = await this.prisma.supplier.findFirst({
      where: { id, businessId },
    });

    if (!supplier) throw new NotFoundException('Supplier not found.');

    return apiResponse('Supplier found.', this.serialize(supplier));
  }

  async update(
    id: string,
    dto: CreateSupplierDto,
    businessId: string,
    userId: string,
    userRole: UserRole,
  ) {
    await this.categoryService.validateStoreAccess(businessId, userId, userRole);

    const supplier = await this.prisma.supplier.findFirst({
      where: { id, businessId },
    });
    if (!supplier) throw new NotFoundException('Supplier not found.');

    const updated = await this.prisma.supplier.update({
      where: { id },
      data: {
        name: dto.name,
        phone: dto.phone ?? null,
        email: dto.email ?? null,
        address: dto.address ?? null,
      },
    });

    return apiResponse('Supplier updated.', this.serialize(updated));
  }

  async remove(
    id: string,
    businessId: string,
    userId: string,
    userRole: UserRole,
  ) {
    await this.categoryService.validateStoreAccess(businessId, userId, userRole);

    const supplier = await this.prisma.supplier.findFirst({
      where: { id, businessId },
    });
    if (!supplier) throw new NotFoundException('Supplier not found.');

    const purchaseCount = await this.prisma.purchase.count({
      where: { supplierId: id },
    });
    if (purchaseCount > 0) {
      throw new BadRequestException(
        'Cannot delete a supplier that has existing purchases.',
      );
    }

    await this.prisma.supplier.delete({ where: { id } });

    return apiResponse('Supplier deleted.', null);
  }

  private serialize(supplier: {
    id: string;
    businessId: string;
    name: string;
    phone: string | null;
    email: string | null;
    address: string | null;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: supplier.id,
      businessId: supplier.businessId,
      name: supplier.name,
      phone: supplier.phone,
      email: supplier.email,
      address: supplier.address,
      createdAt: supplier.createdAt,
      updatedAt: supplier.updatedAt,
    };
  }
}
