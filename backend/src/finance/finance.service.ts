import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import {
  BusinessRole,
  BusinessType,
  PaymentStatus,
  Prisma,
  SaleStatus,
  UserRole,
} from '../../generated/prisma/client';
import type { AuthUser } from '../auth/types';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import { getDateRangeFromPreset } from '../report/report-date.helper';

type FinanceSummaryFilters = {
  rangePreset?: string;
  startDate?: string;
  endDate?: string;
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

    const [totalRevenue, totalExpense] = await Promise.all([
      this.getTotalRevenue(business.type, businessId!, dateRange),
      this.getTotalExpense(businessId!, dateRange),
    ]);

    const netProfit = totalRevenue - totalExpense;

    return {
      period: label,
      startDate: startDate ? startDate.toISOString().slice(0, 10) : null,
      endDate: endDate ? endDate.toISOString().slice(0, 10) : null,
      totalRevenue,
      totalExpense,
      netProfit,
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

    const businesses = await this.getAccessibleBusinesses(
      currentUser.userId,
      currentUser.role,
    );

    const businessSummaries = await Promise.all(
      businesses.map(async (business) => {
        const [revenue, expense] = await Promise.all([
          this.getTotalRevenue(business.type, business.id, dateRange),
          this.getTotalExpense(business.id, dateRange),
        ]);
        return {
          businessId: business.id,
          businessName: business.name,
          businessType: business.type,
          revenue,
          expense,
          netProfit: revenue - expense,
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
  ): Promise<number> {
    if (businessType === BusinessType.STORE) {
      const result = await this.prisma.sale.aggregate({
        _sum: { totalAmount: true },
        where: {
          businessId,
          status: SaleStatus.COMPLETED,
          ...(dateRange ? { createdAt: dateRange } : {}),
        },
      });
      return Number(result._sum.totalAmount ?? 0);
    }

    // GUESTHOUSE: sum PAID payment amounts
    const result = await this.prisma.payment.aggregate({
      _sum: { amount: true },
      where: {
        status: PaymentStatus.PAID,
        ...(dateRange ? { paidAt: dateRange } : {}),
      },
    });
    return Number(result._sum.amount ?? 0);
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
}
