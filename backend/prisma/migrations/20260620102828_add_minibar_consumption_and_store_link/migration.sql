-- CreateEnum
CREATE TYPE "MiniBarConsumptionStatus" AS ENUM ('DRAFT', 'CHARGED', 'CANCELLED', 'REFUNDED');

-- AlterTable
ALTER TABLE "housekeeping_tasks" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- CreateTable
CREATE TABLE "guesthouse_store_links" (
    "id" TEXT NOT NULL,
    "guesthouseBusinessId" TEXT NOT NULL,
    "storeBusinessId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "guesthouse_store_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mini_bar_consumptions" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "guestId" TEXT NOT NULL,
    "totalAmount" DECIMAL(10,2) NOT NULL,
    "status" "MiniBarConsumptionStatus" NOT NULL DEFAULT 'DRAFT',
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mini_bar_consumptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mini_bar_consumption_items" (
    "id" TEXT NOT NULL,
    "consumptionId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPrice" DECIMAL(10,2) NOT NULL,
    "subtotal" DECIMAL(10,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mini_bar_consumption_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "guesthouse_store_links_guesthouseBusinessId_key" ON "guesthouse_store_links"("guesthouseBusinessId");

-- CreateIndex
CREATE INDEX "guesthouse_store_links_storeBusinessId_idx" ON "guesthouse_store_links"("storeBusinessId");

-- CreateIndex
CREATE INDEX "mini_bar_consumptions_businessId_idx" ON "mini_bar_consumptions"("businessId");

-- CreateIndex
CREATE INDEX "mini_bar_consumptions_bookingId_idx" ON "mini_bar_consumptions"("bookingId");

-- CreateIndex
CREATE INDEX "mini_bar_consumptions_roomId_idx" ON "mini_bar_consumptions"("roomId");

-- CreateIndex
CREATE INDEX "mini_bar_consumptions_guestId_idx" ON "mini_bar_consumptions"("guestId");

-- CreateIndex
CREATE INDEX "mini_bar_consumptions_createdById_idx" ON "mini_bar_consumptions"("createdById");

-- CreateIndex
CREATE INDEX "mini_bar_consumptions_status_idx" ON "mini_bar_consumptions"("status");

-- CreateIndex
CREATE INDEX "mini_bar_consumption_items_consumptionId_idx" ON "mini_bar_consumption_items"("consumptionId");

-- CreateIndex
CREATE INDEX "mini_bar_consumption_items_productId_idx" ON "mini_bar_consumption_items"("productId");

-- AddForeignKey
ALTER TABLE "guesthouse_store_links" ADD CONSTRAINT "guesthouse_store_links_guesthouseBusinessId_fkey" FOREIGN KEY ("guesthouseBusinessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guesthouse_store_links" ADD CONSTRAINT "guesthouse_store_links_storeBusinessId_fkey" FOREIGN KEY ("storeBusinessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mini_bar_consumptions" ADD CONSTRAINT "mini_bar_consumptions_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mini_bar_consumptions" ADD CONSTRAINT "mini_bar_consumptions_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mini_bar_consumptions" ADD CONSTRAINT "mini_bar_consumptions_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "rooms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mini_bar_consumptions" ADD CONSTRAINT "mini_bar_consumptions_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "guests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mini_bar_consumptions" ADD CONSTRAINT "mini_bar_consumptions_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mini_bar_consumption_items" ADD CONSTRAINT "mini_bar_consumption_items_consumptionId_fkey" FOREIGN KEY ("consumptionId") REFERENCES "mini_bar_consumptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mini_bar_consumption_items" ADD CONSTRAINT "mini_bar_consumption_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
