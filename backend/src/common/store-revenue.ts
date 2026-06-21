import {
  MiniBarConsumptionStatus,
  Prisma,
  SaleStatus,
} from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export const storeRevenueSources = ['STORE_SALE', 'MINI_BAR', 'ALL'] as const;
export type StoreRevenueSource = (typeof storeRevenueSources)[number];

export type StoreRevenueRow = {
  date: Date;
  amount: number;
  source: 'STORE_SALE' | 'MINI_BAR_CONSUMPTION';
};

/**
 * Revenue a STORE business earns either from direct counter sales, or from
 * mini bar items consumed at a linked guesthouse (charged consumptions only).
 * Each row is tagged with its source so callers can filter or break totals
 * down without a separate stock/revenue ledger table.
 */
export async function getStoreRevenueRows(
  prisma: PrismaService,
  businessId: string,
  range: Prisma.DateTimeFilter | undefined,
  source: StoreRevenueSource = 'ALL',
): Promise<StoreRevenueRow[]> {
  const rows: StoreRevenueRow[] = [];

  if (source === 'STORE_SALE' || source === 'ALL') {
    const sales = await prisma.sale.findMany({
      where: {
        businessId,
        status: SaleStatus.COMPLETED,
        ...(range ? { createdAt: range } : {}),
      },
      select: { createdAt: true, totalAmount: true },
    });
    rows.push(
      ...sales.map((sale) => ({
        date: sale.createdAt,
        amount: Number(sale.totalAmount),
        source: 'STORE_SALE' as const,
      })),
    );
  }

  if (source === 'MINI_BAR' || source === 'ALL') {
    const items = await prisma.miniBarConsumptionItem.findMany({
      where: {
        product: { businessId },
        consumption: {
          status: MiniBarConsumptionStatus.CHARGED,
          ...(range ? { createdAt: range } : {}),
        },
      },
      select: {
        subtotal: true,
        consumption: { select: { createdAt: true } },
      },
    });
    rows.push(
      ...items.map((item) => ({
        date: item.consumption.createdAt,
        amount: Number(item.subtotal),
        source: 'MINI_BAR_CONSUMPTION' as const,
      })),
    );
  }

  return rows;
}

export async function getStoreRevenueTotal(
  prisma: PrismaService,
  businessId: string,
  range: Prisma.DateTimeFilter | undefined,
  source: StoreRevenueSource = 'ALL',
): Promise<number> {
  const rows = await getStoreRevenueRows(prisma, businessId, range, source);
  return rows.reduce((sum, row) => sum + row.amount, 0);
}

export type StoreRevenueBreakdown = {
  storeSaleRevenue: number;
  miniBarRevenue: number;
};

export async function getStoreRevenueBreakdown(
  prisma: PrismaService,
  businessId: string,
  range: Prisma.DateTimeFilter | undefined,
): Promise<StoreRevenueBreakdown> {
  const rows = await getStoreRevenueRows(prisma, businessId, range, 'ALL');

  return rows.reduce(
    (acc, row) => {
      if (row.source === 'STORE_SALE') {
        acc.storeSaleRevenue += row.amount;
      } else {
        acc.miniBarRevenue += row.amount;
      }
      return acc;
    },
    { storeSaleRevenue: 0, miniBarRevenue: 0 },
  );
}

export function isStoreRevenueSource(
  value: string,
): value is StoreRevenueSource {
  return (storeRevenueSources as readonly string[]).includes(value);
}
