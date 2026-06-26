import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import {
  BookingStatus,
  BusinessType,
  HousekeepingPriority,
  HousekeepingStatus,
  RoomStatus,
} from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AutoCheckoutService {
  private readonly logger = new Logger(AutoCheckoutService.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron('* * * * *')
  async runAutoCheckout() {
    const now = new Date();

    const overdueBookings = await this.prisma.booking.findMany({
      where: {
        status: BookingStatus.CHECKED_IN,
        autoCheckoutAt: { not: null, lte: now },
      },
      select: { id: true, roomId: true },
    });

    if (overdueBookings.length === 0) return;

    this.logger.log(
      `Auto-checkout: processing ${overdueBookings.length} booking(s)`,
    );

    const business = await this.prisma.business.findFirst({
      where: { type: BusinessType.GUESTHOUSE },
    });

    if (!business) {
      this.logger.error(
        'Auto-checkout: no GUESTHOUSE business found — skipping',
      );
      return;
    }

    await Promise.allSettled(
      overdueBookings.map((booking) =>
        this.processOne(booking.id, booking.roomId, business.id),
      ),
    );
  }

  private async processOne(
    bookingId: string,
    roomId: string,
    businessId: string,
  ) {
    try {
      await this.prisma.$transaction(async (tx) => {
        // updateMany allows a compound where — no-op if already CHECKED_OUT
        const updated = await tx.booking.updateMany({
          where: { id: bookingId, status: BookingStatus.CHECKED_IN },
          data: {
            status: BookingStatus.CHECKED_OUT,
            checkOutAt: new Date(),
          },
        });

        if (updated.count === 0) return; // already processed by a concurrent run

        await tx.room.update({
          where: { id: roomId },
          data: { status: RoomStatus.NEEDS_CLEANING },
        });

        const existingTask = await tx.housekeepingTask.findFirst({
          where: {
            roomId,
            bookingId,
            status: { not: HousekeepingStatus.CANCELLED },
          },
        });

        if (!existingTask) {
          await tx.housekeepingTask.create({
            data: {
              businessId,
              roomId,
              bookingId,
              status: HousekeepingStatus.NEEDS_CLEANING,
              priority: HousekeepingPriority.MEDIUM,
              note: 'Room needs cleaning after auto check-out',
            },
          });
        }
      });

      this.logger.log(`Auto-checkout: booking ${bookingId} checked out`);
    } catch (err) {
      this.logger.error(
        `Auto-checkout: failed for booking ${bookingId}`,
        err instanceof Error ? err.stack : err,
      );
    }
  }
}
