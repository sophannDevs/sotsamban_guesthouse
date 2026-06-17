import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import {
  BookingStatus,
  BusinessRole,
  BusinessType,
  ExpenseCategory,
  PaymentMethod,
  PaymentStatus,
  Prisma,
  RoomStatus,
  SaleStatus,
  UserRole,
} from '../../generated/prisma/client';
import {
  createPaginatedResult,
  getPaginationOptions,
  PaginationQuery,
} from '../common/pagination';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import { getDateRangeFromPreset } from './report-date.helper';
import { ExcelReportPayload } from './report-excel.service';

type RevenueReportFilters = {
  rangePreset?: string;
  startDate?: string;
  endDate?: string;
};

type BookingReportFilters = RevenueReportFilters & {
  status?: BookingStatus;
  roomId?: string;
  guestId?: string;
};

type PaymentReportFilters = RevenueReportFilters & {
  paymentStatus?: PaymentStatus;
  method?: PaymentMethod;
};

type GuestReportFilters = RevenueReportFilters & {
  search?: string;
};

const reportBookingSortFields = [
  'createdAt',
  'updatedAt',
  'checkInDate',
  'checkOutDate',
  'totalPrice',
  'status',
] as const;

const reportPaymentSortFields = [
  'createdAt',
  'updatedAt',
  'paidAt',
  'amount',
  'method',
  'status',
] as const;

const reportGuestSortFields = [
  'createdAt',
  'updatedAt',
  'fullName',
  'email',
  'phone',
] as const;

export type ReportType =
  | 'revenue'
  | 'bookings'
  | 'payments'
  | 'guests'
  | 'occupancy'
  | 'profit_loss';

export type ReportExportFilters = RevenueReportFilters &
  BookingReportFilters &
  PaymentReportFilters &
  GuestReportFilters & { businessId?: string };

type PaymentForRevenue = Prisma.PaymentGetPayload<{
  include: {
    booking: true;
  };
}>;

type BookingForReport = Prisma.BookingGetPayload<{
  include: {
    guest: true;
    room: true;
  };
}>;

type PaymentForReport = Prisma.PaymentGetPayload<{
  include: {
    booking: {
      include: {
        guest: true;
        room: true;
      };
    };
  };
}>;

type GuestForReport = Prisma.GuestGetPayload<{
  include: {
    bookings: {
      include: {
        payments: true;
      };
    };
  };
}>;

@Injectable()
export class ReportService {
  private readonly bookingInclude = {
    guest: true,
    room: true,
  } satisfies Prisma.BookingInclude;

  private readonly paymentInclude = {
    booking: {
      include: {
        guest: true,
        room: true,
      },
    },
  } satisfies Prisma.PaymentInclude;

  constructor(
    private readonly prisma: PrismaService,
    private readonly settingsService: SettingsService,
  ) {}

  health() {
    return {
      message: 'Report module is working',
    };
  }

  async getRevenueReport(filters: RevenueReportFilters) {
    const dateRange = await this.getDateRange(filters);
    const payments = await this.prisma.payment.findMany({
      where: this.buildPaymentWhere(dateRange),
      include: {
        booking: true,
      },
      orderBy: [
        {
          paidAt: 'asc',
        },
        {
          createdAt: 'asc',
        },
      ],
    });

    return {
      totalRevenue: this.sumPayments(payments),
      paidRevenue: this.sumPayments(
        payments.filter((payment) => payment.status === PaymentStatus.PAID),
      ),
      pendingRevenue: this.sumPayments(
        payments.filter((payment) => payment.status === PaymentStatus.PENDING),
      ),
      revenueByDate: this.getRevenueByDate(payments),
      revenueByPaymentMethod: this.getRevenueByPaymentMethod(payments),
    };
  }

  async getBookingReport(filters: BookingReportFilters & PaginationQuery) {
    const pagination = getPaginationOptions(filters, {
      allowedSortBy: reportBookingSortFields,
      defaultSortBy: 'checkInDate',
    });
    const dateRange = await this.getDateRange(filters);
    const where = this.buildBookingWhere(filters, dateRange);
    const [bookings, total] = await Promise.all([
      this.prisma.booking.findMany({
        where,
        include: this.bookingInclude,
        orderBy: {
          [pagination.sortBy]: pagination.sortOrder,
        },
        skip: pagination.skip,
        take: pagination.limit,
      }),
      this.prisma.booking.count({ where }),
    ]);

    return createPaginatedResult(
      bookings.map((booking) => this.serializeBookingReport(booking)),
      total,
      pagination,
    );
  }

  async getPaymentReport(filters: PaymentReportFilters & PaginationQuery) {
    const pagination = getPaginationOptions(filters, {
      allowedSortBy: reportPaymentSortFields,
      defaultSortBy: 'paidAt',
    });
    const dateRange = await this.getDateRange(filters);
    const where = this.buildPaymentReportWhere(filters, dateRange);
    const [payments, total] = await Promise.all([
      this.prisma.payment.findMany({
        where,
        include: this.paymentInclude,
        orderBy: {
          [pagination.sortBy]: pagination.sortOrder,
        },
        skip: pagination.skip,
        take: pagination.limit,
      }),
      this.prisma.payment.count({ where }),
    ]);

    return createPaginatedResult(
      payments.map((payment) => this.serializePaymentReport(payment)),
      total,
      pagination,
    );
  }

  async getGuestReport(filters: GuestReportFilters & PaginationQuery) {
    const pagination = getPaginationOptions(filters, {
      allowedSortBy: reportGuestSortFields,
      defaultSortBy: 'fullName',
    });
    const dateRange = await this.getDateRange(filters);
    const where = this.buildGuestWhere(filters, dateRange);
    const [guests, total] = await Promise.all([
      this.prisma.guest.findMany({
        where,
        include: {
          bookings: {
            where: this.buildGuestBookingWhere(dateRange),
            include: {
              payments: true,
            },
          },
        },
        orderBy: {
          [pagination.sortBy]: pagination.sortOrder,
        },
        skip: pagination.skip,
        take: pagination.limit,
      }),
      this.prisma.guest.count({ where }),
    ]);

    return createPaginatedResult(
      guests.map((guest) => this.serializeGuestReport(guest)),
      total,
      pagination,
    );
  }

  private async getBookingReportRows(filters: BookingReportFilters) {
    const dateRange = await this.getDateRange(filters);
    const bookings = await this.prisma.booking.findMany({
      where: this.buildBookingWhere(filters, dateRange),
      include: this.bookingInclude,
      orderBy: {
        checkInDate: 'asc',
      },
    });

    return bookings.map((booking) => this.serializeBookingReport(booking));
  }

  private async getPaymentReportRows(filters: PaymentReportFilters) {
    const dateRange = await this.getDateRange(filters);
    const payments = await this.prisma.payment.findMany({
      where: this.buildPaymentReportWhere(filters, dateRange),
      include: this.paymentInclude,
      orderBy: [
        {
          paidAt: 'asc',
        },
        {
          createdAt: 'asc',
        },
      ],
    });

    return payments.map((payment) => this.serializePaymentReport(payment));
  }

  private async getGuestReportRows(filters: GuestReportFilters) {
    const dateRange = await this.getDateRange(filters);
    const guests = await this.prisma.guest.findMany({
      where: this.buildGuestWhere(filters, dateRange),
      include: {
        bookings: {
          where: this.buildGuestBookingWhere(dateRange),
          include: {
            payments: true,
          },
        },
      },
      orderBy: {
        fullName: 'asc',
      },
    });

    return guests.map((guest) => this.serializeGuestReport(guest));
  }

  async getOccupancyReport() {
    const roomsByStatus = await this.prisma.room.groupBy({
      by: ['status'],
      where: {
        deletedAt: null,
      },
      _count: {
        _all: true,
      },
    });
    const roomCounts = this.getRoomCountsByStatus(roomsByStatus);
    const totalRooms = Object.values(roomCounts).reduce(
      (total, count) => total + count,
      0,
    );
    const occupiedRooms = roomCounts[RoomStatus.OCCUPIED];

    return {
      totalRooms,
      availableRooms: roomCounts[RoomStatus.AVAILABLE],
      bookedRooms: roomCounts[RoomStatus.BOOKED],
      occupiedRooms,
      maintenanceRooms: roomCounts[RoomStatus.MAINTENANCE],
      cleaningRooms: roomCounts[RoomStatus.CLEANING],
      occupancyRate: totalRooms === 0 ? 0 : (occupiedRooms / totalRooms) * 100,
    };
  }

  async getProfitLossReport(
    businessId: string | undefined,
    filters: RevenueReportFilters,
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

    const dateRange = await this.getDateRange(filters);
    const range = this.buildDateRangeFilter(dateRange);

    const [revenueRows, expenses] = await Promise.all([
      this.getProfitLossRevenueRows(business.type, businessId, range),
      this.prisma.expense.findMany({
        where: {
          businessId,
          ...(range ? { expenseDate: range } : {}),
        },
        orderBy: { expenseDate: 'asc' },
      }),
    ]);

    const totalRevenue = revenueRows.reduce((sum, r) => sum + r.amount, 0);
    const totalExpense = expenses.reduce(
      (sum, e) => sum + Number(e.amount),
      0,
    );

    return {
      period: dateRange.label,
      totalRevenue,
      totalExpense,
      netProfit: totalRevenue - totalExpense,
      revenueByDate: this.groupByDateKey(
        revenueRows.map((r) => ({ date: r.date, value: r.amount })),
        'revenue',
      ),
      expenseByDate: this.groupByDateKey(
        expenses.map((e) => ({
          date: e.expenseDate,
          value: Number(e.amount),
        })),
        'expense',
      ),
      expenseByCategory: this.groupExpenseByCategory(expenses),
    };
  }

  async getExcelReportPayload(
    type: ReportType,
    filters: ReportExportFilters,
  ): Promise<ExcelReportPayload> {
    switch (type) {
      case 'revenue':
        return this.buildRevenueExcelPayload(filters);
      case 'bookings':
        return this.buildBookingsExcelPayload(filters);
      case 'payments':
        return this.buildPaymentsExcelPayload(filters);
      case 'guests':
        return this.buildGuestsExcelPayload(filters);
      case 'occupancy':
        return this.buildOccupancyExcelPayload();
      case 'profit_loss':
        if (!filters.businessId) {
          throw new BadRequestException(
            'x-business-id header is required for profit_loss reports.',
          );
        }
        return this.buildProfitLossExcelPayload(filters.businessId, filters);
    }
  }

  isReportType(type: string): type is ReportType {
    return [
      'revenue',
      'bookings',
      'payments',
      'guests',
      'occupancy',
      'profit_loss',
    ].includes(type);
  }

  private async getDateRange(filters: RevenueReportFilters) {
    const timezoneSetting = await this.settingsService.findOne('timezone');
    const { startDate, endDate, label } = getDateRangeFromPreset(
      filters.rangePreset,
      filters.startDate,
      filters.endDate,
      timezoneSetting.value,
    );

    return { start: startDate, end: endDate, label };
  }

  private parseDate(value: string, fieldName: string) {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException(`${fieldName} must be a valid date.`);
    }

    return date;
  }

  private buildPaymentWhere(dateRange: { start?: Date; end?: Date }) {
    const hasDateFilter = Boolean(dateRange.start || dateRange.end);

    if (!hasDateFilter) {
      return {};
    }

    const range = {
      ...(dateRange.start ? { gte: dateRange.start } : {}),
      ...(dateRange.end ? { lte: dateRange.end } : {}),
    };

    return {
      OR: [
        {
          status: PaymentStatus.PAID,
          paidAt: range,
        },
        {
          status: {
            not: PaymentStatus.PAID,
          },
          createdAt: range,
        },
      ],
    } satisfies Prisma.PaymentWhereInput;
  }

  private buildPaymentReportWhere(
    filters: PaymentReportFilters,
    dateRange: { start?: Date; end?: Date },
  ) {
    if (filters.paymentStatus && !this.isPaymentStatus(filters.paymentStatus)) {
      throw new BadRequestException(
        `paymentStatus must be one of the following values: ${Object.values(
          PaymentStatus,
        ).join(', ')}`,
      );
    }

    if (filters.method && !this.isPaymentMethod(filters.method)) {
      throw new BadRequestException(
        `method must be one of the following values: ${Object.values(
          PaymentMethod,
        ).join(', ')}`,
      );
    }

    return {
      ...this.buildPaymentWhere(dateRange),
      ...(filters.paymentStatus ? { status: filters.paymentStatus } : {}),
      ...(filters.method ? { method: filters.method } : {}),
    } satisfies Prisma.PaymentWhereInput;
  }

  private buildBookingWhere(
    filters: BookingReportFilters,
    dateRange: { start?: Date; end?: Date },
  ) {
    if (filters.status && !this.isBookingStatus(filters.status)) {
      throw new BadRequestException(
        `status must be one of the following values: ${Object.values(
          BookingStatus,
        ).join(', ')}`,
      );
    }

    const where: Prisma.BookingWhereInput = {
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.roomId ? { roomId: filters.roomId } : {}),
      ...(filters.guestId ? { guestId: filters.guestId } : {}),
    };

    if (dateRange.start || dateRange.end) {
      where.AND = [
        ...(dateRange.end
          ? [
              {
                checkInDate: {
                  lte: dateRange.end,
                },
              },
            ]
          : []),
        ...(dateRange.start
          ? [
              {
                checkOutDate: {
                  gte: dateRange.start,
                },
              },
            ]
          : []),
      ];
    }

    return where;
  }

  private buildGuestWhere(
    filters: GuestReportFilters,
    dateRange: { start?: Date; end?: Date },
  ) {
    const search = filters.search?.trim();
    const where: Prisma.GuestWhereInput = {
      ...(search
        ? {
            OR: [
              {
                fullName: {
                  contains: search,
                  mode: 'insensitive',
                },
              },
              {
                phone: {
                  contains: search,
                  mode: 'insensitive',
                },
              },
              {
                email: {
                  contains: search,
                  mode: 'insensitive',
                },
              },
            ],
          }
        : {}),
    };

    if (dateRange.start || dateRange.end) {
      where.bookings = {
        some: this.buildGuestBookingWhere(dateRange),
      };
    }

    return where;
  }

  private buildGuestBookingWhere(dateRange: { start?: Date; end?: Date }) {
    if (!dateRange.start && !dateRange.end) {
      return {};
    }

    return {
      AND: [
        ...(dateRange.end
          ? [
              {
                checkInDate: {
                  lte: dateRange.end,
                },
              },
            ]
          : []),
        ...(dateRange.start
          ? [
              {
                checkOutDate: {
                  gte: dateRange.start,
                },
              },
            ]
          : []),
      ],
    } satisfies Prisma.BookingWhereInput;
  }

  private getRevenueByDate(payments: PaymentForRevenue[]) {
    const revenueByDate = new Map<string, number>();

    for (const payment of this.getPaidPayments(payments)) {
      if (!payment.paidAt) {
        continue;
      }

      const dateKey = this.formatDateKey(payment.paidAt);
      revenueByDate.set(
        dateKey,
        (revenueByDate.get(dateKey) ?? 0) + Number(payment.amount),
      );
    }

    return Array.from(revenueByDate.entries()).map(([date, revenue]) => ({
      date,
      revenue,
    }));
  }

  private getRevenueByPaymentMethod(payments: PaymentForRevenue[]) {
    const revenueByPaymentMethod = new Map<PaymentMethod, number>();

    for (const payment of this.getPaidPayments(payments)) {
      revenueByPaymentMethod.set(
        payment.method,
        (revenueByPaymentMethod.get(payment.method) ?? 0) +
          Number(payment.amount),
      );
    }

    return Array.from(revenueByPaymentMethod.entries()).map(
      ([method, revenue]) => ({
        method,
        revenue,
      }),
    );
  }

  private getPaidPayments(payments: PaymentForRevenue[]) {
    return payments.filter((payment) => payment.status === PaymentStatus.PAID);
  }

  private async buildRevenueExcelPayload(filters: RevenueReportFilters) {
    const report = await this.getRevenueReport(filters);
    const dateRange = await this.getDateRange(filters);

    return {
      title: 'Revenue Report',
      generatedAt: new Date(),
      filters: { ...this.cleanFilters(filters), 'Date Range': dateRange.label },
      sections: [
        {
          title: 'Summary',
          columns: [
            { header: 'Metric', key: 'metric' },
            { header: 'Value', key: 'value' },
          ],
          rows: [
            { metric: 'Total Revenue', value: report.totalRevenue },
            { metric: 'Paid Revenue', value: report.paidRevenue },
            { metric: 'Pending Revenue', value: report.pendingRevenue },
          ],
        },
        {
          title: 'Revenue By Date',
          columns: [
            { header: 'Date', key: 'date' },
            { header: 'Revenue', key: 'revenue' },
          ],
          rows: report.revenueByDate,
        },
        {
          title: 'Revenue By Payment Method',
          columns: [
            { header: 'Payment Method', key: 'method' },
            { header: 'Revenue', key: 'revenue' },
          ],
          rows: report.revenueByPaymentMethod,
        },
      ],
    } satisfies ExcelReportPayload;
  }

  private async buildBookingsExcelPayload(filters: BookingReportFilters) {
    const report = await this.getBookingReportRows(filters);
    const dateRange = await this.getDateRange(filters);

    return {
      title: 'Booking Report',
      generatedAt: new Date(),
      filters: { ...this.cleanFilters(filters), 'Date Range': dateRange.label },
      sections: [
        {
          columns: [
            { header: 'Booking ID', key: 'bookingId' },
            { header: 'Guest Name', key: 'guestName' },
            { header: 'Room Number', key: 'roomNumber' },
            { header: 'Check In Date', key: 'checkInDate' },
            { header: 'Check Out Date', key: 'checkOutDate' },
            { header: 'Cooling Option', key: 'coolingOption' },
            { header: 'Room Price Total', key: 'roomPriceTotal' },
            { header: 'Cooling Price', key: 'coolingPrice' },
            { header: 'Total Price', key: 'totalPrice' },
            { header: 'Booking Status', key: 'bookingStatus' },
          ],
          rows: report.map((row) => ({
            ...row,
            coolingOption:
              row.coolingOption === 'AIR_CONDITIONER' ? 'Air Conditioner' : 'Fan',
          })),
        },
      ],
    } satisfies ExcelReportPayload;
  }

  private async buildPaymentsExcelPayload(filters: PaymentReportFilters) {
    const report = await this.getPaymentReportRows(filters);
    const dateRange = await this.getDateRange(filters);

    return {
      title: 'Payment Report',
      generatedAt: new Date(),
      filters: { ...this.cleanFilters(filters), 'Date Range': dateRange.label },
      sections: [
        {
          columns: [
            { header: 'Payment ID', key: 'paymentId' },
            { header: 'Booking ID', key: 'bookingId' },
            { header: 'Guest Name', key: 'guestName' },
            { header: 'Room Number', key: 'roomNumber' },
            { header: 'Amount', key: 'amount' },
            { header: 'Method', key: 'method' },
            { header: 'Status', key: 'status' },
            { header: 'Paid At', key: 'paidAt' },
          ],
          rows: report,
        },
      ],
    } satisfies ExcelReportPayload;
  }

  private async buildGuestsExcelPayload(filters: GuestReportFilters) {
    const report = await this.getGuestReportRows(filters);
    const dateRange = await this.getDateRange(filters);

    return {
      title: 'Guest Report',
      generatedAt: new Date(),
      filters: { ...this.cleanFilters(filters), 'Date Range': dateRange.label },
      sections: [
        {
          columns: [
            { header: 'Guest ID', key: 'guestId' },
            { header: 'Full Name', key: 'fullName' },
            { header: 'Phone', key: 'phone' },
            { header: 'Email', key: 'email' },
            { header: 'Total Bookings', key: 'totalBookings' },
            { header: 'Total Spent', key: 'totalSpent' },
          ],
          rows: report,
        },
      ],
    } satisfies ExcelReportPayload;
  }

  private async buildOccupancyExcelPayload() {
    const report = await this.getOccupancyReport();

    return {
      title: 'Occupancy Report',
      generatedAt: new Date(),
      filters: {},
      sections: [
        {
          columns: [
            { header: 'Total Rooms', key: 'totalRooms' },
            { header: 'Available Rooms', key: 'availableRooms' },
            { header: 'Booked Rooms', key: 'bookedRooms' },
            { header: 'Occupied Rooms', key: 'occupiedRooms' },
            { header: 'Maintenance Rooms', key: 'maintenanceRooms' },
            { header: 'Cleaning Rooms', key: 'cleaningRooms' },
            { header: 'Occupancy Rate', key: 'occupancyRate' },
          ],
          rows: [report],
        },
      ],
    } satisfies ExcelReportPayload;
  }

  private cleanFilters(filters: Record<string, string | undefined>) {
    return Object.fromEntries(
      Object.entries(filters).filter(([, value]) => Boolean(value)),
    ) as Record<string, string>;
  }

  private getRoomCountsByStatus(
    roomsByStatus: Array<{ status: RoomStatus; _count: { _all: number } }>,
  ) {
    const counts: Record<RoomStatus, number> = {
      [RoomStatus.AVAILABLE]: 0,
      [RoomStatus.BOOKED]: 0,
      [RoomStatus.OCCUPIED]: 0,
      [RoomStatus.MAINTENANCE]: 0,
      [RoomStatus.CLEANING]: 0,
    };

    for (const roomStatus of roomsByStatus) {
      counts[roomStatus.status] = roomStatus._count._all;
    }

    return counts;
  }

  private sumPayments(payments: PaymentForRevenue[]) {
    return payments.reduce(
      (total, payment) => total + Number(payment.amount),
      0,
    );
  }

  private serializeBookingReport(booking: BookingForReport) {
    return {
      bookingId: booking.id,
      guestName: booking.guest.fullName,
      roomNumber: booking.room.roomNumber,
      checkInDate: booking.checkInDate,
      checkOutDate: booking.checkOutDate,
      coolingOption: booking.coolingOption,
      roomPriceTotal: Number(booking.roomPriceTotal),
      coolingPrice: Number(booking.coolingPrice),
      totalPrice: Number(booking.totalPrice),
      bookingStatus: booking.status,
    };
  }

  private serializePaymentReport(payment: PaymentForReport) {
    return {
      paymentId: payment.id,
      bookingId: payment.bookingId,
      guestName: payment.booking.guest.fullName,
      roomNumber: payment.booking.room.roomNumber,
      amount: Number(payment.amount),
      method: payment.method,
      status: payment.status,
      paidAt: payment.paidAt,
    };
  }

  private serializeGuestReport(guest: GuestForReport) {
    return {
      guestId: guest.id,
      fullName: guest.fullName,
      phone: guest.phone,
      email: guest.email,
      totalBookings: guest.bookings.length,
      totalSpent: guest.bookings.reduce(
        (guestTotal, booking) =>
          guestTotal +
          booking.payments.reduce(
            (bookingTotal, payment) =>
              payment.status === PaymentStatus.PAID
                ? bookingTotal + Number(payment.amount)
                : bookingTotal,
            0,
          ),
        0,
      ),
    };
  }

  private isBookingStatus(status: string): status is BookingStatus {
    return Object.values(BookingStatus).includes(status as BookingStatus);
  }

  private isPaymentStatus(status: string): status is PaymentStatus {
    return Object.values(PaymentStatus).includes(status as PaymentStatus);
  }

  private isPaymentMethod(method: string): method is PaymentMethod {
    return Object.values(PaymentMethod).includes(method as PaymentMethod);
  }

  private formatDateKey(date: Date) {
    return date.toISOString().slice(0, 10);
  }

  private buildDateRangeFilter(dateRange: {
    start?: Date;
    end?: Date;
  }): Prisma.DateTimeFilter | undefined {
    if (!dateRange.start && !dateRange.end) {
      return undefined;
    }

    return {
      ...(dateRange.start ? { gte: dateRange.start } : {}),
      ...(dateRange.end ? { lte: dateRange.end } : {}),
    };
  }

  private async getProfitLossRevenueRows(
    businessType: BusinessType,
    businessId: string,
    range: Prisma.DateTimeFilter | undefined,
  ): Promise<Array<{ date: Date; amount: number }>> {
    if (businessType === BusinessType.STORE) {
      const sales = await this.prisma.sale.findMany({
        where: {
          businessId,
          status: SaleStatus.COMPLETED,
          ...(range ? { createdAt: range } : {}),
        },
        select: { createdAt: true, totalAmount: true },
      });

      return sales.map((s) => ({
        date: s.createdAt,
        amount: Number(s.totalAmount),
      }));
    }

    const payments = await this.prisma.payment.findMany({
      where: {
        status: PaymentStatus.PAID,
        ...(range ? { paidAt: range } : {}),
      },
      select: { paidAt: true, amount: true },
    });

    return payments
      .filter((p): p is typeof p & { paidAt: Date } => p.paidAt !== null)
      .map((p) => ({ date: p.paidAt, amount: Number(p.amount) }));
  }

  private groupByDateKey(
    rows: Array<{ date: Date; value: number }>,
    valueKey: string,
  ) {
    const map = new Map<string, number>();

    for (const row of rows) {
      const key = this.formatDateKey(row.date);
      map.set(key, (map.get(key) ?? 0) + row.value);
    }

    return Array.from(map.entries()).map(([date, value]) => ({
      date,
      [valueKey]: value,
    }));
  }

  private groupExpenseByCategory(
    expenses: Array<{ category: ExpenseCategory; amount: unknown }>,
  ) {
    const map = new Map<string, number>();

    for (const e of expenses) {
      map.set(e.category, (map.get(e.category) ?? 0) + Number(e.amount));
    }

    return Array.from(map.entries()).map(([category, amount]) => ({
      category,
      amount,
    }));
  }

  private async getAccessibleBusinesses(userId: string, userRole: UserRole) {
    if (userRole === UserRole.ADMIN) {
      return this.prisma.business.findMany({ orderBy: { name: 'asc' } });
    }

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

  async getCombinedProfitLossReport(
    userId: string,
    userRole: UserRole,
    filters: RevenueReportFilters,
  ) {
    const businesses = await this.getAccessibleBusinesses(userId, userRole);
    const dateRange = await this.getDateRange(filters);
    const range = this.buildDateRangeFilter(dateRange);

    const businessBreakdown = await Promise.all(
      businesses.map(async (business) => {
        const [revenueRows, expenses] = await Promise.all([
          this.getProfitLossRevenueRows(business.type, business.id, range),
          this.prisma.expense.findMany({
            where: {
              businessId: business.id,
              ...(range ? { expenseDate: range } : {}),
            },
          }),
        ]);

        const revenue = revenueRows.reduce((sum, r) => sum + r.amount, 0);
        const expense = expenses.reduce(
          (sum, e) => sum + Number(e.amount),
          0,
        );

        return {
          businessId: business.id,
          businessName: business.name,
          businessType: business.type as string,
          revenue,
          expense,
          netProfit: revenue - expense,
        };
      }),
    );

    const totalRevenue = businessBreakdown.reduce(
      (sum, b) => sum + b.revenue,
      0,
    );
    const totalExpense = businessBreakdown.reduce(
      (sum, b) => sum + b.expense,
      0,
    );

    return {
      period: dateRange.label,
      startDate: dateRange.start?.toISOString() ?? null,
      endDate: dateRange.end?.toISOString() ?? null,
      totalRevenue,
      totalExpense,
      netProfit: totalRevenue - totalExpense,
      businessBreakdown,
    };
  }

  async buildCombinedProfitLossExcelPayload(
    userId: string,
    userRole: UserRole,
    filters: RevenueReportFilters,
  ) {
    const report = await this.getCombinedProfitLossReport(
      userId,
      userRole,
      filters,
    );
    const isLoss = report.netProfit < 0;

    return {
      title: 'Combined Profit & Loss Report',
      generatedAt: new Date(),
      filters: {
        ...this.cleanFilters(filters),
        'Date Range': report.period,
      },
      sections: [
        {
          title: 'Summary',
          columns: [
            { header: 'Metric', key: 'metric' },
            { header: 'Value', key: 'value' },
          ],
          rows: [
            { metric: 'Total Revenue', value: report.totalRevenue },
            { metric: 'Total Expense', value: report.totalExpense },
            {
              metric: isLoss ? 'Net Loss' : 'Net Profit',
              value: Math.abs(report.netProfit),
            },
          ],
        },
        {
          title: 'Business Breakdown',
          columns: [
            { header: 'Business', key: 'businessName' },
            { header: 'Type', key: 'businessType' },
            { header: 'Revenue', key: 'revenue' },
            { header: 'Expense', key: 'expense' },
            { header: 'Net Profit / Loss', key: 'netProfit' },
          ],
          rows: report.businessBreakdown,
        },
      ],
    } satisfies ExcelReportPayload;
  }

  private async buildProfitLossExcelPayload(
    businessId: string,
    filters: RevenueReportFilters,
  ) {
    const report = await this.getProfitLossReport(businessId, filters);
    const dateRange = await this.getDateRange(filters);
    const isLoss = report.netProfit < 0;

    return {
      title: 'Profit & Loss Report',
      generatedAt: new Date(),
      filters: {
        ...this.cleanFilters(filters),
        'Date Range': dateRange.label,
      },
      sections: [
        {
          title: 'Summary',
          columns: [
            { header: 'Metric', key: 'metric' },
            { header: 'Value', key: 'value' },
          ],
          rows: [
            { metric: 'Total Revenue', value: report.totalRevenue },
            { metric: 'Total Expense', value: report.totalExpense },
            {
              metric: isLoss ? 'Net Loss' : 'Net Profit',
              value: Math.abs(report.netProfit),
            },
          ],
        },
        {
          title: 'Revenue By Date',
          columns: [
            { header: 'Date', key: 'date' },
            { header: 'Revenue', key: 'revenue' },
          ],
          rows: report.revenueByDate,
        },
        {
          title: 'Expense By Date',
          columns: [
            { header: 'Date', key: 'date' },
            { header: 'Expense', key: 'expense' },
          ],
          rows: report.expenseByDate,
        },
        {
          title: 'Expense By Category',
          columns: [
            { header: 'Category', key: 'category' },
            { header: 'Amount', key: 'amount' },
          ],
          rows: report.expenseByCategory,
        },
      ],
    } satisfies ExcelReportPayload;
  }
}
