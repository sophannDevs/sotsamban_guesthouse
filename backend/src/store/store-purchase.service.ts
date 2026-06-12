import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import {
  Prisma,
  PurchaseStatus,
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
import { CreatePurchaseDto } from './dto/create-purchase.dto';
import { UpdatePurchaseDto } from './dto/update-purchase.dto';

export type PurchasePaginationQuery = PaginationQuery & {
  status?: string;
  from?: string;
  to?: string;
};

const purchaseSortFields = ['createdAt', 'updatedAt', 'totalAmount'] as const;

type PurchaseWithRelations = Prisma.PurchaseGetPayload<{
  include: {
    supplier: { select: { id: true; name: true } };
    createdBy: { select: { id: true; name: true } };
    items: {
      include: {
        product: { select: { id: true; name: true; sku: true } };
      };
    };
  };
}>;

@Injectable()
export class StorePurchaseService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly categoryService: StoreCategoryService,
  ) {}

  private readonly purchaseInclude = {
    supplier: { select: { id: true, name: true } },
    createdBy: { select: { id: true, name: true } },
    items: {
      include: {
        product: { select: { id: true, name: true, sku: true } },
      },
    },
  } satisfies Prisma.PurchaseInclude;

  async create(
    dto: CreatePurchaseDto,
    businessId: string,
    userId: string,
    userRole: UserRole,
  ) {
    await this.categoryService.validateStoreAccess(businessId, userId, userRole);

    const purchase = await this.prisma.$transaction(async (tx) => {
      // 1. Validate supplier
      const supplier = await tx.supplier.findFirst({
        where: { id: dto.supplierId, businessId },
      });
      if (!supplier) {
        throw new NotFoundException('Supplier not found in this business.');
      }

      // 2. Validate items and compute prices
      const resolvedItems: Array<{
        productId: string;
        quantity: number;
        costPrice: Prisma.Decimal;
        subtotal: Prisma.Decimal;
      }> = [];

      for (const item of dto.items) {
        const product = await tx.product.findFirst({
          where: { id: item.productId, businessId, deletedAt: null },
        });
        if (!product) {
          throw new NotFoundException(
            `Product "${item.productId}" not found in this business.`,
          );
        }

        const costPrice = new Prisma.Decimal(item.costPrice);
        const subtotal = costPrice.mul(item.quantity);
        resolvedItems.push({
          productId: item.productId,
          quantity: item.quantity,
          costPrice,
          subtotal,
        });
      }

      // 3. Compute totalAmount
      const totalAmount = resolvedItems.reduce(
        (sum, item) => sum.add(item.subtotal),
        new Prisma.Decimal(0),
      );

      // 4. Generate unique purchaseNumber
      const year = new Date().getFullYear();
      const prefix = `PUR-${year}-`;
      const existingCount = await tx.purchase.count({
        where: { businessId, purchaseNumber: { startsWith: prefix } },
      });
      const purchaseNumber = `${prefix}${String(existingCount + 1).padStart(6, '0')}`;

      // 5. Create purchase + items
      return tx.purchase.create({
        data: {
          businessId,
          purchaseNumber,
          supplierId: dto.supplierId,
          totalAmount,
          status: PurchaseStatus.DRAFT,
          createdById: userId,
          items: {
            create: resolvedItems.map((item) => ({
              productId: item.productId,
              quantity: item.quantity,
              costPrice: item.costPrice,
              subtotal: item.subtotal,
            })),
          },
        },
        include: this.purchaseInclude,
      });
    });

    return apiResponse('Purchase created.', this.serialize(purchase));
  }

  async findAll(
    businessId: string,
    query: PurchasePaginationQuery,
    userId: string,
    userRole: UserRole,
  ) {
    await this.categoryService.validateStoreAccess(businessId, userId, userRole);

    const pagination = getPaginationOptions(query, {
      allowedSortBy: purchaseSortFields,
      defaultSortBy: 'createdAt',
    });

    const where: Prisma.PurchaseWhereInput = {
      businessId,
      ...(query.status ? { status: query.status as PurchaseStatus } : {}),
      ...(query.from || query.to
        ? {
            createdAt: {
              ...(query.from ? { gte: new Date(query.from) } : {}),
              ...(query.to
                ? {
                    lte: new Date(
                      new Date(query.to).setHours(23, 59, 59, 999),
                    ),
                  }
                : {}),
            },
          }
        : {}),
      ...(pagination.search
        ? {
            OR: [
              {
                purchaseNumber: {
                  contains: pagination.search,
                  mode: 'insensitive' as const,
                },
              },
              {
                supplier: {
                  name: {
                    contains: pagination.search,
                    mode: 'insensitive' as const,
                  },
                },
              },
            ],
          }
        : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.purchase.findMany({
        where,
        include: this.purchaseInclude,
        orderBy: { [pagination.sortBy]: pagination.sortOrder },
        skip: pagination.skip,
        take: pagination.limit,
      }),
      this.prisma.purchase.count({ where }),
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

    const purchase = await this.prisma.purchase.findFirst({
      where: { id, businessId },
      include: this.purchaseInclude,
    });

    if (!purchase) throw new NotFoundException('Purchase not found.');

    return apiResponse('Purchase found.', this.serialize(purchase));
  }

  async update(
    id: string,
    dto: UpdatePurchaseDto,
    businessId: string,
    userId: string,
    userRole: UserRole,
  ) {
    await this.categoryService.validateStoreAccess(businessId, userId, userRole);

    const purchase = await this.prisma.purchase.findFirst({
      where: { id, businessId },
    });
    if (!purchase) throw new NotFoundException('Purchase not found.');
    if (purchase.status !== PurchaseStatus.DRAFT) {
      throw new BadRequestException(
        'Only DRAFT purchases can be edited.',
      );
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      let supplierId = purchase.supplierId;

      if (dto.supplierId) {
        const supplier = await tx.supplier.findFirst({
          where: { id: dto.supplierId, businessId },
        });
        if (!supplier) {
          throw new NotFoundException('Supplier not found in this business.');
        }
        supplierId = dto.supplierId;
      }

      let totalAmount = purchase.totalAmount;

      if (dto.items && dto.items.length > 0) {
        // Delete existing items
        await tx.purchaseItem.deleteMany({ where: { purchaseId: id } });

        // Validate and create new items
        const resolvedItems: Array<{
          productId: string;
          quantity: number;
          costPrice: Prisma.Decimal;
          subtotal: Prisma.Decimal;
        }> = [];

        for (const item of dto.items) {
          const product = await tx.product.findFirst({
            where: { id: item.productId, businessId, deletedAt: null },
          });
          if (!product) {
            throw new NotFoundException(
              `Product "${item.productId}" not found in this business.`,
            );
          }

          const costPrice = new Prisma.Decimal(item.costPrice);
          const subtotal = costPrice.mul(item.quantity);
          resolvedItems.push({
            productId: item.productId,
            quantity: item.quantity,
            costPrice,
            subtotal,
          });
        }

        // Re-create items
        for (const item of resolvedItems) {
          await tx.purchaseItem.create({
            data: {
              purchaseId: id,
              productId: item.productId,
              quantity: item.quantity,
              costPrice: item.costPrice,
              subtotal: item.subtotal,
            },
          });
        }

        totalAmount = resolvedItems.reduce(
          (sum, item) => sum.add(item.subtotal),
          new Prisma.Decimal(0),
        );
      }

      return tx.purchase.update({
        where: { id },
        data: { supplierId, totalAmount },
        include: this.purchaseInclude,
      });
    });

    return apiResponse('Purchase updated.', this.serialize(updated));
  }

  async complete(
    id: string,
    businessId: string,
    userId: string,
    userRole: UserRole,
  ) {
    await this.categoryService.validateStoreAccess(businessId, userId, userRole);

    const purchase = await this.prisma.purchase.findFirst({
      where: { id, businessId },
      include: { items: true },
    });
    if (!purchase) throw new NotFoundException('Purchase not found.');
    if (purchase.status !== PurchaseStatus.DRAFT) {
      throw new BadRequestException(
        `Only DRAFT purchases can be completed. Current status: ${purchase.status}.`,
      );
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      // Increment stock for each item
      for (const item of purchase.items) {
        await tx.product.update({
          where: { id: item.productId },
          data: { stockQuantity: { increment: item.quantity } },
        });
      }

      return tx.purchase.update({
        where: { id },
        data: { status: PurchaseStatus.COMPLETED },
        include: this.purchaseInclude,
      });
    });

    return apiResponse(
      'Purchase completed and stock increased.',
      this.serialize(updated),
    );
  }

  async cancel(
    id: string,
    businessId: string,
    userId: string,
    userRole: UserRole,
  ) {
    await this.categoryService.validateStoreAccess(businessId, userId, userRole);

    const purchase = await this.prisma.purchase.findFirst({
      where: { id, businessId },
    });
    if (!purchase) throw new NotFoundException('Purchase not found.');
    if (purchase.status !== PurchaseStatus.DRAFT) {
      throw new BadRequestException(
        `Only DRAFT purchases can be cancelled. Current status: ${purchase.status}.`,
      );
    }

    const updated = await this.prisma.purchase.update({
      where: { id },
      data: { status: PurchaseStatus.CANCELLED },
      include: this.purchaseInclude,
    });

    return apiResponse('Purchase cancelled.', this.serialize(updated));
  }

  private serialize(purchase: PurchaseWithRelations) {
    return {
      id: purchase.id,
      businessId: purchase.businessId,
      purchaseNumber: purchase.purchaseNumber,
      supplier: purchase.supplier,
      totalAmount: Number(purchase.totalAmount),
      status: purchase.status,
      createdBy: purchase.createdBy,
      items: purchase.items.map((item) => ({
        id: item.id,
        productId: item.productId,
        product: item.product,
        quantity: item.quantity,
        costPrice: Number(item.costPrice),
        subtotal: Number(item.subtotal),
      })),
      createdAt: purchase.createdAt,
      updatedAt: purchase.updatedAt,
    };
  }
}
