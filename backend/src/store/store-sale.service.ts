import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import {
  Prisma,
  SaleStatus,
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
import { CreateSaleDto } from './dto/create-sale.dto';

export type SalePaginationQuery = PaginationQuery & {
  status?: string;
  from?: string;
  to?: string;
};

const saleSortFields = ['createdAt', 'updatedAt', 'totalAmount'] as const;

type SaleWithRelations = Prisma.SaleGetPayload<{
  include: {
    soldBy: { select: { id: true; name: true } };
    items: {
      include: {
        product: { select: { id: true; name: true; sku: true } };
      };
    };
  };
}>;

@Injectable()
export class StoreSaleService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly categoryService: StoreCategoryService,
  ) {}

  private readonly saleInclude = {
    soldBy: { select: { id: true, name: true } },
    items: {
      include: {
        product: { select: { id: true, name: true, sku: true } },
      },
    },
  } satisfies Prisma.SaleInclude;

  async create(
    dto: CreateSaleDto,
    businessId: string,
    userId: string,
    userRole: UserRole,
  ) {
    await this.categoryService.validateStoreAccess(businessId, userId, userRole);

    const sale = await this.prisma.$transaction(async (tx) => {
      // 1. Validate and price all items
      const resolvedItems: Array<{
        productId: string;
        quantity: number;
        unitPrice: Prisma.Decimal;
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

        if (product.status !== 'ACTIVE') {
          throw new BadRequestException(
            `Product "${product.name}" is inactive and cannot be sold.`,
          );
        }

        if (product.stockQuantity < item.quantity) {
          throw new BadRequestException(
            `Insufficient stock for "${product.name}". Available: ${product.stockQuantity}, requested: ${item.quantity}.`,
          );
        }

        const unitPrice = product.sellingPrice;
        const subtotal = new Prisma.Decimal(unitPrice).mul(item.quantity);

        resolvedItems.push({
          productId: item.productId,
          quantity: item.quantity,
          unitPrice,
          subtotal,
        });
      }

      // 2. Calculate totalAmount
      const totalAmount = resolvedItems.reduce(
        (sum, item) => sum.add(item.subtotal),
        new Prisma.Decimal(0),
      );

      // 3. Generate unique saleNumber within this transaction
      const year = new Date().getFullYear();
      const prefix = `SALE-${year}-`;
      const existingCount = await tx.sale.count({
        where: { businessId, saleNumber: { startsWith: prefix } },
      });
      const saleNumber = `${prefix}${String(existingCount + 1).padStart(6, '0')}`;

      // 4. Create the sale
      const newSale = await tx.sale.create({
        data: {
          businessId,
          saleNumber,
          totalAmount,
          paymentMethod: dto.paymentMethod,
          status: SaleStatus.COMPLETED,
          soldById: userId,
          items: {
            create: resolvedItems.map((item) => ({
              productId: item.productId,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              subtotal: item.subtotal,
            })),
          },
        },
        include: this.saleInclude,
      });

      // 5. Decrement stock for each product
      for (const item of resolvedItems) {
        await tx.product.update({
          where: { id: item.productId },
          data: { stockQuantity: { decrement: item.quantity } },
        });
      }

      return newSale;
    });

    return apiResponse('Sale created.', this.serialize(sale));
  }

  async findAll(
    businessId: string,
    query: SalePaginationQuery,
    userId: string,
    userRole: UserRole,
  ) {
    await this.categoryService.validateStoreAccess(businessId, userId, userRole);

    const pagination = getPaginationOptions(query, {
      allowedSortBy: saleSortFields,
      defaultSortBy: 'createdAt',
    });

    const where: Prisma.SaleWhereInput = {
      businessId,
      ...(query.status ? { status: query.status as SaleStatus } : {}),
      ...(query.from || query.to
        ? {
            createdAt: {
              ...(query.from ? { gte: new Date(query.from) } : {}),
              ...(query.to
                ? { lte: new Date(new Date(query.to).setHours(23, 59, 59, 999)) }
                : {}),
            },
          }
        : {}),
      ...(pagination.search
        ? {
            OR: [
              {
                saleNumber: {
                  contains: pagination.search,
                  mode: 'insensitive' as const,
                },
              },
              {
                soldBy: {
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
      this.prisma.sale.findMany({
        where,
        include: this.saleInclude,
        orderBy: { [pagination.sortBy]: pagination.sortOrder },
        skip: pagination.skip,
        take: pagination.limit,
      }),
      this.prisma.sale.count({ where }),
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

    const sale = await this.prisma.sale.findFirst({
      where: { id, businessId },
      include: this.saleInclude,
    });

    if (!sale) {
      throw new NotFoundException('Sale not found.');
    }

    return apiResponse('Sale found.', this.serialize(sale));
  }

  async cancel(
    id: string,
    businessId: string,
    userId: string,
    userRole: UserRole,
  ) {
    await this.categoryService.validateStoreAccess(businessId, userId, userRole);

    const sale = await this.prisma.sale.findFirst({
      where: { id, businessId },
      include: { items: true },
    });

    if (!sale) {
      throw new NotFoundException('Sale not found.');
    }

    if (sale.status !== SaleStatus.COMPLETED) {
      throw new BadRequestException(
        `Only COMPLETED sales can be cancelled. Current status: ${sale.status}.`,
      );
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      // Restore stock
      for (const item of sale.items) {
        await tx.product.update({
          where: { id: item.productId },
          data: { stockQuantity: { increment: item.quantity } },
        });
      }

      return tx.sale.update({
        where: { id },
        data: { status: SaleStatus.CANCELLED },
        include: this.saleInclude,
      });
    });

    return apiResponse('Sale cancelled and stock restored.', this.serialize(updated));
  }

  async refund(
    id: string,
    businessId: string,
    userId: string,
    userRole: UserRole,
  ) {
    await this.categoryService.validateStoreAccess(businessId, userId, userRole);

    const sale = await this.prisma.sale.findFirst({
      where: { id, businessId },
      include: { items: true },
    });

    if (!sale) {
      throw new NotFoundException('Sale not found.');
    }

    if (sale.status !== SaleStatus.COMPLETED) {
      throw new BadRequestException(
        `Only COMPLETED sales can be refunded. Current status: ${sale.status}.`,
      );
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      // Restore stock
      for (const item of sale.items) {
        await tx.product.update({
          where: { id: item.productId },
          data: { stockQuantity: { increment: item.quantity } },
        });
      }

      return tx.sale.update({
        where: { id },
        data: { status: SaleStatus.REFUNDED },
        include: this.saleInclude,
      });
    });

    return apiResponse('Sale refunded and stock restored.', this.serialize(updated));
  }

  private serialize(sale: SaleWithRelations) {
    return {
      id: sale.id,
      businessId: sale.businessId,
      saleNumber: sale.saleNumber,
      totalAmount: Number(sale.totalAmount),
      paymentMethod: sale.paymentMethod,
      status: sale.status,
      soldBy: sale.soldBy,
      items: sale.items.map((item) => ({
        id: item.id,
        productId: item.productId,
        product: item.product,
        quantity: item.quantity,
        unitPrice: Number(item.unitPrice),
        subtotal: Number(item.subtotal),
      })),
      createdAt: sale.createdAt,
      updatedAt: sale.updatedAt,
    };
  }
}
