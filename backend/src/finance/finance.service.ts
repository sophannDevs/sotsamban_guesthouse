import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import {
  BookingType,
  BusinessRole,
  BusinessType,
  PaymentStatus,
  Prisma,
  UserRole,
} from '../../generated/prisma/client';
import type { AuthUser } from '../auth/types';
import {
  getStoreRevenueBreakdown,
  getStoreRevenueTotal,
  isStoreRevenueSource,
  type StoreRevenueSource,
} from '../common/store-revenue';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import { getDateRangeFromPreset } from '../report/report-date.helper';

type FinanceSummaryFilters = {
  rangePreset?: string;
  startDate?: string;
  endDate?: string;
  /** STORE-only revenue filter; ignored for GUESTHOUSE businesses. */
  source?: string;
};

@Injectable()
export class FinanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settingsService: SettingsService,
  ) {}

  private async validateBusinessAccess(
    businessId: string | undefined,
    userId: string,
    userRole: UserRole,
  ) {
    if (!businessId) {
      throw new BadRequestException('x-business-id header is required.');
    }
    const business = await this.prisma.business.findUnique({
      where: { id: businessId },
    });
    if (!business) {
      throw new NotFoundException('Business not found.');
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

  async getSummary(
    businessId: string | undefined,
    filters: FinanceSummaryFilters,
    currentUser: AuthUser,
  ) {
    const business = await this.validateBusinessAccess(
      businessId,
      currentUser.userId,
      currentUser.role,
    );

    const timezoneSetting = await this.settingsService.findOne('timezone');
    const timezone = timezoneSetting.value || 'Asia/Phnom_Penh';

    const { startDate, endDate, label } = getDateRangeFromPreset(
      filters.rangePreset,
      filters.startDate,
      filters.endDate,
      timezone,
    );

    const hasDateFilter = Boolean(startDate || endDate);

    const dateRange = hasDateFilter
      ? {
          ...(startDate ? { gte: startDate } : {}),
          ...(endDate ? { lte: endDate } : {}),
        }
      : undefined;

    const source = this.parseRevenueSource(filters.source);

    const [totalRevenue, totalExpense, breakdown, bookingTypeRevenue] =
      await Promise.all([
        this.getTotalRevenue(business.type, businessId!, dateRange, source),
        this.getTotalExpense(businessId!, dateRange),
        business.type === BusinessType.STORE
          ? getStoreRevenueBreakdown(this.prisma, businessId!, dateRange)
          : Promise.resolve(undefined),
        business.type === BusinessType.GUESTHOUSE
          ? this.getBookingTypeRevenue(dateRange)
          : Promise.resolve(undefined),
      ]);

    const netProfit = totalRevenue - totalExpense;

    return {
      period: label,
      startDate: startDate ? startDate.toISOString().slice(0, 10) : null,
      endDate: endDate ? endDate.toISOString().slice(0, 10) : null,
      totalRevenue,
      totalExpense,
      netProfit,
      ...(breakdown ?? {}),
      ...(bookingTypeRevenue ? { bookingTypeRevenue } : {}),
    };
  }

  async getAllBusinessesSummary(
    filters: FinanceSummaryFilters,
    currentUser: AuthUser,
  ) {
    const timezoneSetting = await this.settingsService.findOne('timezone');
    const timezone = timezoneSetting.value || 'Asia/Phnom_Penh';

    const { startDate, endDate, label } = getDateRangeFromPreset(
      filters.rangePreset,
      filters.startDate,
      filters.endDate,
      timezone,
    );

    const dateRange =
      startDate || endDate
        ? {
            ...(startDate ? { gte: startDate } : {}),
            ...(endDate ? { lte: endDate } : {}),
          }
        : undefined;

    const source = this.parseRevenueSource(filters.source);

    const businesses = await this.getAccessibleBusinesses(
      currentUser.userId,
      currentUser.role,
    );

    const businessSummaries = await Promise.all(
      businesses.map(async (business) => {
        const [revenue, expense, breakdown] = await Promise.all([
          this.getTotalRevenue(business.type, business.id, dateRange, source),
          this.getTotalExpense(business.id, dateRange),
          business.type === BusinessType.STORE
            ? getStoreRevenueBreakdown(this.prisma, business.id, dateRange)
            : Promise.resolve(undefined),
        ]);
        return {
          businessId: business.id,
          businessName: business.name,
          businessType: business.type,
          revenue,
          expense,
          netProfit: revenue - expense,
          ...(breakdown ?? {}),
        };
      }),
    );

    const totalRevenue = businessSummaries.reduce(
      (sum, b) => sum + b.revenue,
      0,
    );
    const totalExpense = businessSummaries.reduce(
      (sum, b) => sum + b.expense,
      0,
    );

    return {
      period: label,
      startDate: startDate ? startDate.toISOString().slice(0, 10) : null,
      endDate: endDate ? endDate.toISOString().slice(0, 10) : null,
      totalRevenue,
      totalExpense,
      netProfit: totalRevenue - totalExpense,
      businesses: businessSummaries,
    };
  }

  private async getAccessibleBusinesses(userId: string, userRole: UserRole) {
    if (userRole === UserRole.ADMIN) {
      return this.prisma.business.findMany({ orderBy: { name: 'asc' } });
    }

    // Include businesses the user owns directly OR has OWNER/ADMIN member role in
    return this.prisma.business.findMany({
      where: {
        OR: [
          { ownerId: userId },
          {
            members: {
              some: {
                userId,
                role: { in: [BusinessRole.OWNER, BusinessRole.ADMIN] },
              },
            },
          },
        ],
      },
      orderBy: { name: 'asc' },
    });
  }

  private async getTotalRevenue(
    businessType: BusinessType,
    businessId: string,
    dateRange: Prisma.DateTimeFilter | undefined,
    source: StoreRevenueSource,
  ): Promise<number> {
    if (businessType === BusinessType.STORE) {
      return getStoreRevenueTotal(this.prisma, businessId, dateRange, source);
    }

    // GUESTHOUSE: sum PAID payment amounts (the source filter only applies to STORE revenue)
    const result = await this.prisma.payment.aggregate({
      _sum: { amount: true },
      where: {
        status: PaymentStatus.PAID,
        ...(dateRange ? { paidAt: dateRange } : {}),
      },
    });
    return Number(result._sum.amount ?? 0);
  }

  /**
   * Defaults to STORE_SALE so existing finance summaries keep their current
   * revenue figures unless a caller explicitly opts into mini bar revenue.
   */
  private parseRevenueSource(source: string | undefined): StoreRevenueSource {
    if (!source) {
      return 'STORE_SALE';
    }
    if (!isStoreRevenueSource(source)) {
      throw new BadRequestException(
        `source must be one of the following values: STORE_SALE, MINI_BAR, ALL`,
      );
    }
    return source;
  }

  private async getTotalExpense(
    businessId: string,
    dateRange: Prisma.DateTimeFilter | undefined,
  ): Promise<number> {
    const result = await this.prisma.expense.aggregate({
      _sum: { amount: true },
      where: {
        businessId,
        ...(dateRange ? { expenseDate: dateRange } : {}),
      },
    });
    return Number(result._sum.amount ?? 0);
  }

  private async getBookingTypeRevenue(
    dateRange: Prisma.DateTimeFilter | undefined,
  ) {
    const payments = await this.prisma.payment.findMany({
      where: {
        status: PaymentStatus.PAID,
        ...(dateRange ? { paidAt: dateRange } : {}),
      },
      select: {
        amount: true,
        booking: { select: { bookingType: true } },
      },
    });

    const map = new Map<string, number>();
    for (const p of payments) {
      const type = p.booking.bookingType;
      map.set(type, (map.get(type) ?? 0) + Number(p.amount));
    }

    return {
      hourlyRevenue: map.get(BookingType.HOURLY) ?? 0,
      halfDayRevenue: map.get(BookingType.HALF_DAY) ?? 0,
      dailyRevenue: map.get(BookingType.DAILY) ?? 0,
    };
  }
}
