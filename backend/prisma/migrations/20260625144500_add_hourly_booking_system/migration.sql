-- CreateEnum
CREATE TYPE "BookingType" AS ENUM ('HOURLY', 'HALF_DAY', 'DAILY');

-- CreateEnum
CREATE TYPE "StayDuration" AS ENUM (
  'TWO_HOURS',
  'THREE_HOURS',
  'SIX_HOURS',
  'TWELVE_HOURS',
  'TWENTY_FOUR_HOURS'
);

-- CreateEnum
CREATE TYPE "SessionType" AS ENUM ('DAY', 'NIGHT');

-- AlterTable
ALTER TABLE "bookings"
  ADD COLUMN "bookingType" "BookingType" NOT NULL DEFAULT 'DAILY',
  ADD COLUMN "stayDuration" "StayDuration",
  ADD COLUMN "sessionType" "SessionType",
  ADD COLUMN "checkInTime" TIMESTAMP(3),
  ADD COLUMN "checkOutTime" TIMESTAMP(3),
  ADD COLUMN "autoCheckoutAt" TIMESTAMP(3);
