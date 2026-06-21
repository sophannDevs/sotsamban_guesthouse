import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import {
  Business,
  BookingStatus,
  BusinessType,
  MiniBarConsumptionStatus,
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
import { CreateMiniBarConsumptionDto } from './dto/create-mini-bar-consumption.dto';
import { UpdateMiniBarConsumptionDto } from './dto/update-mini-bar-consumption.dto';

export type MiniBarConsumptionPaginationQuery = PaginationQuery & {
  status?: string;
  bookingId?: string;
  from?: string;
  to?: string;
};

const consumptionSortFields = [
  'createdAt',
  'updatedAt',
  'totalAmount',
] as const;

const consumptionInclude = {
  booking: { select: { id: true, status: true } },
  room: { select: { id: true, roomNumber: true } },
  guest: { select: { id: true, fullName: true } },
  createdBy: { select: { id: true, name: true } },
  items: {
    include: {
      product: { select: { id: true, name: true, sku: true } },
    },
  },
} satisfies Prisma.MiniBarConsumptionInclude;

type ConsumptionWithRelations = Prisma.MiniBarConsumptionGetPayload<{
  include: typeof consumptionInclude;
}>;

type ResolvedItem = {
  productId: string;
  quantity: number;
  unitPrice: Prisma.Decimal;
  subtotal: Prisma.Decimal;
};

@Injectable()
export class MiniBarConsumptionService {
  constructor(private readonly prisma: PrismaService) {}

  async listEligibleProducts(
    businessId: string,
    userId: string,
    userRole: UserRole,
  ) {
    await this.assertGuesthouseAccess(businessId, userId, userRole);

    const storeBusinessId = await this.getLinkedStoreBusinessId(businessId);

    const products = await this.prisma.product.findMany({
      where: {
        businessId: storeBusinessId,
        status: ProductStatus.ACTIVE,
        deletedAt: null,
      },
      select: {
        id: true,
        name: true,
        sku: true,
        sellingPrice: true,
        stockQuantity: true,
      },
      orderBy: { name: 'asc' },
    });

    return apiResponse(
      'Eligible products retrieved successfully.',
      products.map((product) => ({
        ...product,
        sellingPrice: Number(product.sellingPrice),
      })),
    );
  }

  async create(
    dto: CreateMiniBarConsumptionDto,
    businessId: string,
    userId: string,
    userRole: UserRole,
  ) {
    await this.assertGuesthouseAccess(businessId, userId, userRole);

    const booking = await this.prisma.booking.findUnique({
      where: { id: dto.bookingId },
    });
    if (!booking) {
      throw new NotFoundException('Booking not found.');
    }
    this.assertBookingIsActiveStay(booking.status);

    const storeBusinessId = await this.getLinkedStoreBusinessId(businessId);

    const consumption = await this.prisma.$transaction(async (tx) => {
      const resolvedItems = await this.resolveItems(
        tx,
        storeBusinessId,
        dto.items,
      );
      const totalAmount = this.sumSubtotals(resolvedItems);

      return tx.miniBarConsumption.create({
        data: {
          businessId,
          bookingId: booking.id,
          roomId: booking.roomId,
          guestId: booking.guestId,
          totalAmount,
          status: MiniBarConsumptionStatus.DRAFT,
          createdById: userId,
          items: {
            create: resolvedItems.map((item) => ({
              productId: item.productId,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              subtotal: item.subtotal,
            })),
          },
        },
        include: consumptionInclude,
      });
    });

    return apiResponse(
      'Mini bar consumption created.',
      this.serialize(consumption),
    );
  }

  async findAll(
    businessId: string,
    query: MiniBarConsumptionPaginationQuery,
    userId: string,
    userRole: UserRole,
  ) {
    await this.assertGuesthouseAccess(businessId, userId, userRole);

    const pagination = getPaginationOptions(query, {
      allowedSortBy: consumptionSortFields,
      defaultSortBy: 'createdAt',
    });

    const where: Prisma.MiniBarConsumptionWhereInput = {
      businessId,
      ...(query.status
        ? { status: query.status as MiniBarConsumptionStatus }
        : {}),
      ...(query.bookingId ? { bookingId: query.bookingId } : {}),
      ...(query.from || query.to
        ? {
            createdAt: {
              ...(query.from ? { gte: new Date(query.from) } : {}),
              ...(query.to
                ? {
                    lte: new Date(new Date(query.to).setHours(23, 59, 59, 999)),
                  }
                : {}),
            },
          }
        : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.miniBarConsumption.findMany({
        where,
        include: consumptionInclude,
        orderBy: { [pagination.sortBy]: pagination.sortOrder },
        skip: pagination.skip,
        take: pagination.limit,
      }),
      this.prisma.miniBarConsumption.count({ where }),
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
    await this.assertGuesthouseAccess(businessId, userId, userRole);

    const consumption = await this.findConsumptionOrThrow(id, businessId);

    return apiResponse(
      'Mini bar consumption found.',
      this.serialize(consumption),
    );
  }

  async update(
    id: string,
    dto: UpdateMiniBarConsumptionDto,
    businessId: string,
    userId: string,
    userRole: UserRole,
  ) {
    await this.assertGuesthouseAccess(businessId, userId, userRole);

    const consumption = await this.findConsumptionOrThrow(id, businessId);
    this.assertStatus(
      consumption.status,
      MiniBarConsumptionStatus.DRAFT,
      'edited',
    );

    if (!dto.items) {
      return apiResponse(
        'Mini bar consumption updated.',
        this.serialize(consumption),
      );
    }

    const storeBusinessId = await this.getLinkedStoreBusinessId(businessId);

    const updated = await this.prisma.$transaction(async (tx) => {
      const resolvedItems = await this.resolveItems(
        tx,
        storeBusinessId,
        dto.items!,
      );
      const totalAmount = this.sumSubtotals(resolvedItems);

      await tx.miniBarConsumptionItem.deleteMany({
        where: { consumptionId: id },
      });

      return tx.miniBarConsumption.update({
        where: { id },
        data: {
          totalAmount,
          items: {
            create: resolvedItems.map((item) => ({
              productId: item.productId,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              subtotal: item.subtotal,
            })),
          },
        },
        include: consumptionInclude,
      });
    });

    return apiResponse(
      'Mini bar consumption updated.',
      this.serialize(updated),
    );
  }

  async charge(
    id: string,
    businessId: string,
    userId: string,
    userRole: UserRole,
  ) {
    await this.assertGuesthouseAccess(businessId, userId, userRole);

    const consumption = await this.findConsumptionOrThrow(id, businessId);
    this.assertStatus(
      consumption.status,
      MiniBarConsumptionStatus.DRAFT,
      'charged',
    );

    const storeBusinessId = await this.getLinkedStoreBusinessId(businessId);

    const updated = await this.prisma.$transaction(async (tx) => {
      // Re-validate product state and stock at charge time since it may have
      // changed since the draft was created.
      for (const item of consumption.items) {
        const product = await tx.product.findFirst({
          where: {
            id: item.productId,
            businessId: storeBusinessId,
            deletedAt: null,
          },
        });
        if (!product) {
          throw new NotFoundException(
            `Product "${item.productId}" no longer exists in the linked store.`,
          );
        }
        if (product.status !== ProductStatus.ACTIVE) {
          throw new BadRequestException(
            `Product "${product.name}" is inactive and cannot be charged.`,
          );
        }
        if (product.stockQuantity < item.quantity) {
          throw new BadRequestException(
            `Insufficient stock for "${product.name}". Available: ${product.stockQuantity}, requested: ${item.quantity}.`,
          );
        }

        await tx.product.update({
          where: { id: item.productId },
          data: { stockQuantity: { decrement: item.quantity } },
        });
      }

      return tx.miniBarConsumption.update({
        where: { id },
        data: { status: MiniBarConsumptionStatus.CHARGED },
        include: consumptionInclude,
      });
    });

    // booking.totalPrice/balanceDue are derived live from CHARGED consumptions,
    // so no separate booking write is needed here.
    return apiResponse(
      'Mini bar consumption charged and stock reduced.',
      this.serialize(updated),
    );
  }

  async cancel(
    id: string,
    businessId: string,
    userId: string,
    userRole: UserRole,
  ) {
    await this.assertGuesthouseAccess(businessId, userId, userRole);

    const consumption = await this.findConsumptionOrThrow(id, businessId);
    this.assertStatus(
      consumption.status,
      MiniBarConsumptionStatus.DRAFT,
      'cancelled',
    );

    // Still DRAFT, so stock was never reduced — no stock adjustment needed.
    const updated = await this.prisma.miniBarConsumption.update({
      where: { id },
      data: { status: MiniBarConsumptionStatus.CANCELLED },
      include: consumptionInclude,
    });

    return apiResponse(
      'Mini bar consumption cancelled.',
      this.serialize(updated),
    );
  }

  async refund(
    id: string,
    businessId: string,
    userId: string,
    userRole: UserRole,
  ) {
    await this.assertGuesthouseAccess(businessId, userId, userRole);

    const consumption = await this.findConsumptionOrThrow(id, businessId);
    this.assertStatus(
      consumption.status,
      MiniBarConsumptionStatus.CHARGED,
      'refunded',
    );

    const updated = await this.prisma.$transaction(async (tx) => {
      for (const item of consumption.items) {
        await tx.product.update({
          where: { id: item.productId },
          data: { stockQuantity: { increment: item.quantity } },
        });
      }

      return tx.miniBarConsumption.update({
        where: { id },
        data: { status: MiniBarConsumptionStatus.REFUNDED },
        include: consumptionInclude,
      });
    });

    return apiResponse(
      'Mini bar consumption refunded and stock restored.',
      this.serialize(updated),
    );
  }

  private async resolveItems(
    tx: Prisma.TransactionClient,
    storeBusinessId: string,
    items: Array<{ productId: string; quantity: number }>,
  ): Promise<ResolvedItem[]> {
    const resolvedItems: ResolvedItem[] = [];

    for (const item of items) {
      const product = await tx.product.findFirst({
        where: {
          id: item.productId,
          businessId: storeBusinessId,
          deletedAt: null,
        },
      });

      if (!product) {
        throw new NotFoundException(
          `Product "${item.productId}" not found in the linked store.`,
        );
      }
      if (product.status !== ProductStatus.ACTIVE) {
        throw new BadRequestException(
          `Product "${product.name}" is inactive and cannot be consumed.`,
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

    return resolvedItems;
  }

  private sumSubtotals(items: ResolvedItem[]) {
    return items.reduce(
      (sum, item) => sum.add(item.subtotal),
      new Prisma.Decimal(0),
    );
  }

  private async getLinkedStoreBusinessId(
    guesthouseBusinessId: string,
  ): Promise<string> {
    const link = await this.prisma.guesthouseStoreLink.findUnique({
      where: { guesthouseBusinessId },
    });

    if (!link) {
      throw new BadRequestException(
        'This guesthouse is not linked to a store for mini bar inventory.',
      );
    }

    return link.storeBusinessId;
  }

  private assertBookingIsActiveStay(status: BookingStatus) {
    if (
      status !== BookingStatus.CHECKED_IN &&
      status !== BookingStatus.CHECKED_OUT
    ) {
      throw new BadRequestException(
        `Mini bar consumption requires a CHECKED_IN or CHECKED_OUT booking. Current status: ${status}.`,
      );
    }
  }

  private assertStatus(
    current: MiniBarConsumptionStatus,
    required: MiniBarConsumptionStatus,
    action: string,
  ) {
    if (current !== required) {
      throw new BadRequestException(
        `Only ${required} consumptions can be ${action}. Current status: ${current}.`,
      );
    }
  }

  private async findConsumptionOrThrow(id: string, businessId: string) {
    const consumption = await this.prisma.miniBarConsumption.findFirst({
      where: { id, businessId },
      include: consumptionInclude,
    });

    if (!consumption) {
      throw new NotFoundException('Mini bar consumption not found.');
    }

    return consumption;
  }

  private async assertGuesthouseAccess(
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

    if (business.type !== BusinessType.GUESTHOUSE) {
      throw new ForbiddenException(
        'This endpoint is only available for GUESTHOUSE businesses.',
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

  private serialize(consumption: ConsumptionWithRelations) {
    return {
      id: consumption.id,
      businessId: consumption.businessId,
      bookingId: consumption.bookingId,
      booking: consumption.booking,
      roomId: consumption.roomId,
      room: consumption.room,
      guestId: consumption.guestId,
      guest: consumption.guest,
      totalAmount: Number(consumption.totalAmount),
      status: consumption.status,
      createdBy: consumption.createdBy,
      items: consumption.items.map((item) => ({
        id: item.id,
        productId: item.productId,
        product: item.product,
        quantity: item.quantity,
        unitPrice: Number(item.unitPrice),
        subtotal: Number(item.subtotal),
      })),
      createdAt: consumption.createdAt,
      updatedAt: consumption.updatedAt,
    };
  }
}
