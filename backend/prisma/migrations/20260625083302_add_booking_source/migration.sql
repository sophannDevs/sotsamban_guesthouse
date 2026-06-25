-- CreateEnum
CREATE TYPE "BookingSource" AS ENUM ('ONLINE', 'WALK_IN');

-- AlterTable
ALTER TABLE "bookings" ADD COLUMN     "source" "BookingSource" NOT NULL DEFAULT 'ONLINE';
