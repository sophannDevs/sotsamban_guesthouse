import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PaymentStatus, Prisma } from '../../generated/prisma/client';

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

    this.ensureAmountDoesNotExceedBookingTotal(
      createPaymentDto.amount,
      booking.totalPrice,
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
      payments.map((payment) => this.serializePayment(payment)),
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

    this.ensureAmountDoesNotExceedBookingTotal(amount, booking.totalPrice);

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

  private ensureAmountDoesNotExceedBookingTotal(
    amount: number,
    bookingTotalPrice: Prisma.Decimal,
  ) {
    if (amount > Number(bookingTotalPrice)) {
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

  private serializePayment(payment: PaymentWithRelations) {
    return {
      ...payment,
      amount: Number(payment.amount),
      booking: {
        ...payment.booking,
        totalPrice: Number(payment.booking.totalPrice),
        room: {
          ...payment.booking.room,
          pricePerNight: Number(payment.booking.room.pricePerNight),
        },
      },
    };
  }
}
