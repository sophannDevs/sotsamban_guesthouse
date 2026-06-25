import { BadRequestException, Injectable } from '@nestjs/common';
import {
  BookingType,
  Prisma,
  SessionType,
  StayDuration,
} from '../../generated/prisma/client';

export type CalculateBookingPriceInput = {
  roomPricePerDay: Prisma.Decimal | number | string;
  bookingType?: BookingType;
  stayDuration?: StayDuration | null;
  sessionType?: SessionType | null;
};

export type BookingPriceBreakdown = {
  basePrice: Prisma.Decimal;
  durationPrice: Prisma.Decimal;
  sessionPrice: Prisma.Decimal;
  totalPrice: Prisma.Decimal;
};

const durationMultipliers: Record<StayDuration, Prisma.Decimal> = {
  [StayDuration.TWO_HOURS]: new Prisma.Decimal('0.2'),
  [StayDuration.THREE_HOURS]: new Prisma.Decimal('0.3'),
  [StayDuration.SIX_HOURS]: new Prisma.Decimal('0.5'),
  [StayDuration.TWELVE_HOURS]: new Prisma.Decimal('0.8'),
  [StayDuration.TWENTY_FOUR_HOURS]: new Prisma.Decimal('1'),
};

const sessionMultipliers: Record<SessionType, Prisma.Decimal> = {
  [SessionType.DAY]: new Prisma.Decimal('1'),
  [SessionType.NIGHT]: new Prisma.Decimal('1.2'),
};

@Injectable()
export class PricingService {
  calculateBookingPrice({
    roomPricePerDay,
    bookingType = BookingType.DAILY,
    stayDuration,
    sessionType,
  }: CalculateBookingPriceInput): BookingPriceBreakdown {
    const basePrice = new Prisma.Decimal(roomPricePerDay);
    const durationMultiplier = this.getDurationMultiplier(
      bookingType,
      stayDuration,
    );
    const sessionMultiplier = sessionType
      ? sessionMultipliers[sessionType]
      : new Prisma.Decimal(1);

    const durationPrice = basePrice.mul(durationMultiplier);
    const totalPrice = durationPrice.mul(sessionMultiplier);
    const sessionPrice = totalPrice.sub(durationPrice);

    return {
      basePrice,
      durationPrice,
      sessionPrice,
      totalPrice,
    };
  }

  private getDurationMultiplier(
    bookingType: BookingType,
    stayDuration?: StayDuration | null,
  ) {
    if (bookingType === BookingType.DAILY) {
      return durationMultipliers[StayDuration.TWENTY_FOUR_HOURS];
    }

    if (bookingType === BookingType.HALF_DAY) {
      return durationMultipliers[stayDuration ?? StayDuration.SIX_HOURS];
    }

    if (!stayDuration) {
      throw new BadRequestException(
        'stayDuration is required for hourly bookings.',
      );
    }

    return durationMultipliers[stayDuration];
  }
}
