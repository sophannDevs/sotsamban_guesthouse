import {
  BookingType,
  SessionType,
  StayDuration,
} from '../../generated/prisma/client';
import { PricingService } from './pricing.service';

describe('PricingService', () => {
  let service: PricingService;

  beforeEach(() => {
    service = new PricingService();
  });

  it.each([
    [StayDuration.TWO_HOURS, '20'],
    [StayDuration.THREE_HOURS, '30'],
    [StayDuration.SIX_HOURS, '50'],
    [StayDuration.TWELVE_HOURS, '80'],
    [StayDuration.TWENTY_FOUR_HOURS, '100'],
  ])('prices %s hourly bookings from the daily rate', (stayDuration, expected) => {
    const result = service.calculateBookingPrice({
      roomPricePerDay: 100,
      bookingType: BookingType.HOURLY,
      stayDuration,
      sessionType: SessionType.DAY,
    });

    expect(result.basePrice.toString()).toBe('100');
    expect(result.durationPrice.toString()).toBe(expected);
    expect(result.sessionPrice.toString()).toBe('0');
    expect(result.totalPrice.toString()).toBe(expected);
  });

  it('adds the night session multiplier as a separate price component', () => {
    const result = service.calculateBookingPrice({
      roomPricePerDay: 100,
      bookingType: BookingType.HOURLY,
      stayDuration: StayDuration.THREE_HOURS,
      sessionType: SessionType.NIGHT,
    });

    expect(result.basePrice.toString()).toBe('100');
    expect(result.durationPrice.toString()).toBe('30');
    expect(result.sessionPrice.toString()).toBe('6');
    expect(result.totalPrice.toString()).toBe('36');
  });

  it('defaults daily bookings to the full daily rate', () => {
    const result = service.calculateBookingPrice({
      roomPricePerDay: 100,
      bookingType: BookingType.DAILY,
    });

    expect(result.basePrice.toString()).toBe('100');
    expect(result.durationPrice.toString()).toBe('100');
    expect(result.sessionPrice.toString()).toBe('0');
    expect(result.totalPrice.toString()).toBe('100');
  });
});
