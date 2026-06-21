import {
  MiniBarConsumptionStatus,
  PaymentStatus,
  Prisma,
} from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';

type PrismaOrTx = PrismaService | Prisma.TransactionClient;

export async function getMiniBarTotalsByBookingIds(
  prisma: PrismaOrTx,
  bookingIds: string[],
): Promise<Map<string, Prisma.Decimal>> {
  if (bookingIds.length === 0) {
    return new Map();
  }

  const sums = await prisma.miniBarConsumption.groupBy({
    by: ['bookingId'],
    where: {
      bookingId: { in: bookingIds },
      status: MiniBarConsumptionStatus.CHARGED,
    },
    _sum: { totalAmount: true },
  });

  return new Map(
    sums.map((row) => [
      row.bookingId,
      row._sum.totalAmount ?? new Prisma.Decimal(0),
    ]),
  );
}

export async function getMiniBarTotalForBooking(
  prisma: PrismaOrTx,
  bookingId: string,
): Promise<Prisma.Decimal> {
  const totals = await getMiniBarTotalsByBookingIds(prisma, [bookingId]);
  return totals.get(bookingId) ?? new Prisma.Decimal(0);
}

export async function getPaidAmountsByBookingIds(
  prisma: PrismaOrTx,
  bookingIds: string[],
): Promise<Map<string, Prisma.Decimal>> {
  if (bookingIds.length === 0) {
    return new Map();
  }

  const sums = await prisma.payment.groupBy({
    by: ['bookingId'],
    where: { bookingId: { in: bookingIds }, status: PaymentStatus.PAID },
    _sum: { amount: true },
  });

  return new Map(
    sums.map((row) => [
      row.bookingId,
      row._sum.amount ?? new Prisma.Decimal(0),
    ]),
  );
}

export async function getPaidAmountForBooking(
  prisma: PrismaOrTx,
  bookingId: string,
): Promise<Prisma.Decimal> {
  const totals = await getPaidAmountsByBookingIds(prisma, [bookingId]);
  return totals.get(bookingId) ?? new Prisma.Decimal(0);
}

export function computeTotalPrice(
  roomPriceTotal: Prisma.Decimal | number,
  coolingPrice: Prisma.Decimal | number,
  miniBarTotal: Prisma.Decimal | number,
): Prisma.Decimal {
  return new Prisma.Decimal(roomPriceTotal).add(coolingPrice).add(miniBarTotal);
}

export function computeBalanceDue(
  totalPrice: Prisma.Decimal | number,
  paidAmount: Prisma.Decimal | number,
): Prisma.Decimal {
  return new Prisma.Decimal(totalPrice).sub(paidAmount);
}
