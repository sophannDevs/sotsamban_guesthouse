/*
  Warnings:

  - Added the required column `coolingPrice` to the `bookings` table without a default value. This is not possible if the table is not empty.
  - Added the required column `roomPriceTotal` to the `bookings` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "CoolingOption" AS ENUM ('FAN', 'AIR_CONDITIONER');

-- AlterTable
ALTER TABLE "bookings" ADD COLUMN     "coolingOption" "CoolingOption" NOT NULL DEFAULT 'FAN',
ADD COLUMN     "coolingPrice" DECIMAL(10,2) NOT NULL,
ADD COLUMN     "roomPriceTotal" DECIMAL(10,2) NOT NULL;
