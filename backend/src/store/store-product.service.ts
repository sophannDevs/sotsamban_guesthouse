import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import {
  Prisma,
  ProductStatus,
  UserRole,
} from '../../generated/prisma/client';
import { apiResponse } from '../common/api-response';
import {
  createPaginatedResult,
  getPaginationOptions,
  PaginationQuery,
} from '../common/pagination';
import { PrismaService } from '../prisma/prisma.service';
import { StoreCategoryService } from './store-category.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';

const productSortFields = [
  'createdAt',
  'updatedAt',
  'name',
  'sku',
  'sellingPrice',
  'stockQuantity',
] as const;

export type ProductPaginationQuery = PaginationQuery & {
  status?: string;
  categoryId?: string;
};

type ProductWithCategory = Prisma.ProductGetPayload<{
  include: { category: { select: { id: true; name: true } } };
}>;

@Injectable()
export class StoreProductService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly categoryService: StoreCategoryService,
  ) {}

  private readonly productInclude = {
    category: { select: { id: true, name: true } },
  } satisfies Prisma.ProductInclude;

  async create(
    dto: CreateProductDto,
    businessId: string,
    userId: string,
    userRole: UserRole,
  ) {
    await this.categoryService.validateStoreAccess(businessId, userId, userRole);

    if (dto.categoryId) {
      const category = await this.prisma.productCategory.findFirst({
        where: { id: dto.categoryId, businessId, deletedAt: null },
      });
      if (!category) {
        throw new NotFoundException('Category not found in this business.');
      }
    }

    try {
      const product = await this.prisma.product.create({
        data: {
          businessId,
          categoryId: dto.categoryId ?? null,
          name: dto.name,
          sku: dto.sku.trim().toUpperCase(),
          barcode: dto.barcode?.trim() || null,
          purchasePrice: new Prisma.Decimal(dto.purchasePrice),
          sellingPrice: new Prisma.Decimal(dto.sellingPrice),
          stockQuantity: dto.stockQuantity ?? 0,
          lowStockAlert: dto.lowStockAlert ?? 10,
          status: dto.status ?? ProductStatus.ACTIVE,
        },
        include: this.productInclude,
      });

      return apiResponse('Product created.', this.serialize(product));
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'A product with this SKU already exists in this business.',
        );
      }
      throw error;
    }
  }

  async findAll(
    businessId: string,
    query: ProductPaginationQuery,
    userId: string,
    userRole: UserRole,
  ) {
    await this.categoryService.validateStoreAccess(businessId, userId, userRole);

    const pagination = getPaginationOptions(query, {
      allowedSortBy: productSortFields,
      defaultSortBy: 'createdAt',
    });

    const where: Prisma.ProductWhereInput = {
      businessId,
      deletedAt: null,
      ...(query.status ? { status: query.status as ProductStatus } : {}),
      ...(query.categoryId ? { categoryId: query.categoryId } : {}),
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
                sku: {
                  contains: pagination.search,
                  mode: 'insensitive' as const,
                },
              },
              {
                barcode: {
                  contains: pagination.search,
                  mode: 'insensitive' as const,
                },
              },
            ],
          }
        : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        include: this.productInclude,
        orderBy: { [pagination.sortBy]: pagination.sortOrder },
        skip: pagination.skip,
        take: pagination.limit,
      }),
      this.prisma.product.count({ where }),
    ]);

    return createPaginatedResult(
      data.map((p) => this.serialize(p)),
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

    const product = await this.prisma.product.findFirst({
      where: { id, businessId, deletedAt: null },
      include: this.productInclude,
    });

    if (!product) {
      throw new NotFoundException('Product not found.');
    }

    return apiResponse('Product found.', this.serialize(product));
  }

  async update(
    id: string,
    dto: UpdateProductDto,
    businessId: string,
    userId: string,
    userRole: UserRole,
  ) {
    await this.categoryService.validateStoreAccess(businessId, userId, userRole);

    const existing = await this.prisma.product.findFirst({
      where: { id, businessId, deletedAt: null },
    });

    if (!existing) {
      throw new NotFoundException('Product not found.');
    }

    if (dto.categoryId !== undefined) {
      if (dto.categoryId !== null) {
        const category = await this.prisma.productCategory.findFirst({
          where: { id: dto.categoryId, businessId, deletedAt: null },
        });
        if (!category) {
          throw new NotFoundException('Category not found in this business.');
        }
      }
    }

    try {
      const updated = await this.prisma.product.update({
        where: { id },
        data: {
          ...(dto.name !== undefined ? { name: dto.name } : {}),
          ...(dto.sku !== undefined
            ? { sku: dto.sku.trim().toUpperCase() }
            : {}),
          ...(dto.barcode !== undefined
            ? { barcode: dto.barcode?.trim() || null }
            : {}),
          ...(dto.categoryId !== undefined
            ? { categoryId: dto.categoryId ?? null }
            : {}),
          ...(dto.purchasePrice !== undefined
            ? { purchasePrice: new Prisma.Decimal(dto.purchasePrice) }
            : {}),
          ...(dto.sellingPrice !== undefined
            ? { sellingPrice: new Prisma.Decimal(dto.sellingPrice) }
            : {}),
          ...(dto.stockQuantity !== undefined
            ? { stockQuantity: dto.stockQuantity }
            : {}),
          ...(dto.lowStockAlert !== undefined
            ? { lowStockAlert: dto.lowStockAlert }
            : {}),
          ...(dto.status !== undefined ? { status: dto.status } : {}),
        },
        include: this.productInclude,
      });

      return apiResponse('Product updated.', this.serialize(updated));
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'A product with this SKU already exists in this business.',
        );
      }
      throw error;
    }
  }

  async remove(
    id: string,
    businessId: string,
    userId: string,
    userRole: UserRole,
  ) {
    await this.categoryService.validateStoreAccess(businessId, userId, userRole);

    const existing = await this.prisma.product.findFirst({
      where: { id, businessId, deletedAt: null },
    });

    if (!existing) {
      throw new NotFoundException('Product not found.');
    }

    await this.prisma.product.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    return apiResponse('Product deleted.', null);
  }

  private serialize(product: ProductWithCategory) {
    return {
      id: product.id,
      businessId: product.businessId,
      categoryId: product.categoryId,
      category: product.category,
      name: product.name,
      sku: product.sku,
      barcode: product.barcode,
      purchasePrice: Number(product.purchasePrice),
      sellingPrice: Number(product.sellingPrice),
      stockQuantity: product.stockQuantity,
      lowStockAlert: product.lowStockAlert,
      status: product.status,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
      deletedAt: product.deletedAt,
    };
  }
}
