import { Module } from '@nestjs/common';

import { PrismaModule } from '../prisma/prisma.module';
import { StoreCategoryController } from './store-category.controller';
import { StoreCategoryService } from './store-category.service';
import { StoreProductController } from './store-product.controller';
import { StoreProductService } from './store-product.service';
import { StoreSaleController } from './store-sale.controller';
import { StoreSaleService } from './store-sale.service';
import { StoreSupplierController } from './store-supplier.controller';
import { StoreSupplierService } from './store-supplier.service';
import { StorePurchaseController } from './store-purchase.controller';
import { StorePurchaseService } from './store-purchase.service';

@Module({
  imports: [PrismaModule],
  controllers: [
    StoreCategoryController,
    StoreProductController,
    StoreSaleController,
    StoreSupplierController,
    StorePurchaseController,
  ],
  providers: [
    StoreCategoryService,
    StoreProductService,
    StoreSaleService,
    StoreSupplierService,
    StorePurchaseService,
  ],
  exports: [
    StoreCategoryService,
    StoreProductService,
    StoreSaleService,
    StoreSupplierService,
    StorePurchaseService,
  ],
})
export class StoreModule {}
