import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PaymentStatus, Prisma } from '../../generated/prisma/client';

import {
  computeBalanceDue,
  computeTotalPrice,
  getMiniBarTotalForBooking,
  getMiniBarTotalsByBookingIds,
  getPaidAmountForBooking,
  getPaidAmountsByBookingIds,
} from '../common/booking-totals';
import { translateError } from '../common/i18n';
import {
  createPaginatedResult,
  getPaginationOptions,
  PaginationQuery,
} from '../common/pagination';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { UpdatePaymentDto } from './dto/update-payment.dto';

type PaymentWithRelations = Prisma.PaymentGetPayload<{
  include: {
    booking: {
      include: {
        guest: true;
        room: true;
      };
    };
  };
}>;

const paymentSortFields = [
  'createdAt',
  'updatedAt',
  'amount',
  'method',
  'status',
  'paidAt',
] as const;

@Injectable()
export class PaymentsService {
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
    private readonly notificationsService: NotificationsService,
  ) {}

  async create(createPaymentDto: CreatePaymentDto, actorUserId?: string) {
    const booking = await this.findBookingById(createPaymentDto.bookingId);
    const status = createPaymentDto.status ?? PaymentStatus.PENDING;

    await this.ensureAmountDoesNotExceedBookingTotal(
      createPaymentDto.amount,
      booking,
    );

    const payment = await this.prisma.payment.create({
      data: {
        bookingId: booking.id,
        amount: new Prisma.Decimal(createPaymentDto.amount),
        method: createPaymentDto.method,
        status,
        paidAt: status === PaymentStatus.PAID ? new Date() : null,
      },
      include: this.paymentInclude,
    });

    if (actorUserId && payment.status === PaymentStatus.PAID) {
      await this.notificationsService.notifyPaymentPaid(
        actorUserId,
        payment.id,
        payment.bookingId,
      );
    }

    return this.serializePayment(payment);
  }

  async findAll(query: PaginationQuery & { status?: PaymentStatus }) {
    const pagination = getPaginationOptions(query, {
      allowedSortBy: paymentSortFields,
      defaultSortBy: 'createdAt',
    });

    if (query.status && !this.isPaymentStatus(query.status)) {
      throw new BadRequestException(
        `status must be one of the following values: ${Object.values(
          PaymentStatus,
        ).join(', ')}`,
      );
    }

    const where: Prisma.PaymentWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(pagination.search
        ? {
            OR: [
              {
                id: {
                  contains: pagination.search,
                  mode: 'insensitive',
                },
              },
              {
                bookingId: {
                  contains: pagination.search,
                  mode: 'insensitive',
                },
              },
              {
                booking: {
                  guest: {
                    fullName: {
                      contains: pagination.search,
                      mode: 'insensitive',
                    },
                  },
                },
              },
              {
                booking: {
                  room: {
                    roomNumber: {
                      contains: pagination.search,
                      mode: 'insensitive',
                    },
                  },
                },
              },
            ],
          }
        : {}),
    };

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
      await this.serializePayments(payments),
      total,
      pagination,
    );
  }

  async findOne(id: string) {
    const payment = await this.findPaymentById(id);

    return this.serializePayment(payment);
  }

  async update(
    id: string,
    updatePaymentDto: UpdatePaymentDto,
    actorUserId?: string,
  ) {
    const existingPayment = await this.findPaymentById(id);
    const bookingId = updatePaymentDto.bookingId ?? existingPayment.bookingId;
    const amount = updatePaymentDto.amount ?? Number(existingPayment.amount);
    const status = updatePaymentDto.status ?? existingPayment.status;
    const booking = await this.findBookingById(bookingId);

    await this.ensureAmountDoesNotExceedBookingTotal(amount, booking);

    try {
      const payment = await this.prisma.payment.update({
        where: { id },
        data: {
          bookingId: booking.id,
          amount: new Prisma.Decimal(amount),
          method: updatePaymentDto.method,
          status: updatePaymentDto.status,
          paidAt:
            status === PaymentStatus.PAID
              ? (existingPayment.paidAt ?? new Date())
              : existingPayment.paidAt,
        },
        include: this.paymentInclude,
      });

      if (
        actorUserId &&
        payment.status === PaymentStatus.PAID &&
        existingPayment.status !== PaymentStatus.PAID
      ) {
        await this.notificationsService.notifyPaymentPaid(
          actorUserId,
          payment.id,
          payment.bookingId,
        );
      }

      return this.serializePayment(payment);
    } catch (error) {
      this.handlePrismaError(error);
    }
  }

  private async findPaymentById(id: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { id },
      include: this.paymentInclude,
    });

    if (!payment) {
      throw new NotFoundException(translateError('paymentNotFound'));
    }

    return payment;
  }

  private async findBookingById(id: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id },
    });

    if (!booking) {
      throw new NotFoundException(translateError('bookingNotFound'));
    }

    return booking;
  }

  private async ensureAmountDoesNotExceedBookingTotal(
    amount: number,
    booking: {
      id: string;
      roomPriceTotal: Prisma.Decimal;
      coolingPrice: Prisma.Decimal;
    },
  ) {
    const miniBarTotal = await getMiniBarTotalForBooking(
      this.prisma,
      booking.id,
    );
    const totalPrice = computeTotalPrice(
      booking.roomPriceTotal,
      booking.coolingPrice,
      miniBarTotal,
    );

    if (amount > Number(totalPrice)) {
      throw new ConflictException(
        'Payment amount cannot be greater than booking totalPrice.',
      );
    }
  }

  private isPaymentStatus(status: string): status is PaymentStatus {
    return Object.values(PaymentStatus).includes(status as PaymentStatus);
  }

  private handlePrismaError(error: unknown): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2025'
    ) {
      throw new NotFoundException(translateError('paymentNotFound'));
    }

    throw error;
  }

  private async serializePayment(payment: PaymentWithRelations) {
    const [miniBarTotal, paidAmount] = await Promise.all([
      getMiniBarTotalForBooking(this.prisma, payment.booking.id),
      getPaidAmountForBooking(this.prisma, payment.booking.id),
    ]);

    return this.buildPaymentResponse(payment, miniBarTotal, paidAmount);
  }

  private async serializePayments(payments: PaymentWithRelations[]) {
    const bookingIds = payments.map((payment) => payment.booking.id);
    const [miniBarTotals, paidAmounts] = await Promise.all([
      getMiniBarTotalsByBookingIds(this.prisma, bookingIds),
      getPaidAmountsByBookingIds(this.prisma, bookingIds),
    ]);

    return payments.map((payment) =>
      this.buildPaymentResponse(
        payment,
        miniBarTotals.get(payment.booking.id) ?? new Prisma.Decimal(0),
        paidAmounts.get(payment.booking.id) ?? new Prisma.Decimal(0),
      ),
    );
  }

  private buildPaymentResponse(
    payment: PaymentWithRelations,
    miniBarTotal: Prisma.Decimal,
    paidAmount: Prisma.Decimal,
  ) {
    const totalPrice = computeTotalPrice(
      payment.booking.roomPriceTotal,
      payment.booking.coolingPrice,
      miniBarTotal,
    );
    const balanceDue = computeBalanceDue(totalPrice, paidAmount);

    return {
      ...payment,
      amount: Number(payment.amount),
      booking: {
        ...payment.booking,
        roomPriceTotal: Number(payment.booking.roomPriceTotal),
        coolingPrice: Number(payment.booking.coolingPrice),
        miniBarTotal: Number(miniBarTotal),
        totalPrice: Number(totalPrice),
        paidAmount: Number(paidAmount),
        balanceDue: Number(balanceDue),
        room: {
          ...payment.booking.room,
          pricePerNight: Number(payment.booking.room.pricePerNight),
        },
      },
    };
  }
}
