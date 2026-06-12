-- CreateEnum
CREATE TYPE "SaleStatus" AS ENUM ('COMPLETED', 'CANCELLED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "StorePaymentMethod" AS ENUM ('CASH', 'CARD', 'QR', 'BANK_TRANSFER');

-- AlterTable: add saleItems relation to products (no DDL needed, handled by FK on sale_items)

-- CreateTable: sales
CREATE TABLE "sales" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "saleNumber" TEXT NOT NULL,
    "totalAmount" DECIMAL(10,2) NOT NULL,
    "paymentMethod" "StorePaymentMethod" NOT NULL,
    "status" "SaleStatus" NOT NULL DEFAULT 'COMPLETED',
    "soldById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "sales_pkey" PRIMARY KEY ("id")
);

-- CreateTable: sale_items
CREATE TABLE "sale_items" (
    "id" TEXT NOT NULL,
    "saleId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPrice" DECIMAL(10,2) NOT NULL,
    "subtotal" DECIMAL(10,2) NOT NULL,
    CONSTRAINT "sale_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: unique sale number per business
CREATE UNIQUE INDEX "sales_businessId_saleNumber_key" ON "sales"("businessId", "saleNumber");

-- CreateIndex
CREATE INDEX "sales_businessId_idx" ON "sales"("businessId");
CREATE INDEX "sales_soldById_idx" ON "sales"("soldById");
CREATE INDEX "sales_status_idx" ON "sales"("status");
CREATE INDEX "sales_createdAt_idx" ON "sales"("createdAt");
CREATE INDEX "sale_items_saleId_idx" ON "sale_items"("saleId");
CREATE INDEX "sale_items_productId_idx" ON "sale_items"("productId");

-- AddForeignKey: sales -> businesses
ALTER TABLE "sales" ADD CONSTRAINT "sales_businessId_fkey"
    FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: sales -> users (soldBy)
ALTER TABLE "sales" ADD CONSTRAINT "sales_soldById_fkey"
    FOREIGN KEY ("soldById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: sale_items -> sales
ALTER TABLE "sale_items" ADD CONSTRAINT "sale_items_saleId_fkey"
    FOREIGN KEY ("saleId") REFERENCES "sales"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: sale_items -> products
ALTER TABLE "sale_items" ADD CONSTRAINT "sale_items_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
