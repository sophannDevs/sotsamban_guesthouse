import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';

import { UserRole } from '../../generated/prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthUser } from '../auth/types';
import { CreatePurchaseDto } from './dto/create-purchase.dto';
import { UpdatePurchaseDto } from './dto/update-purchase.dto';
import {
  StorePurchaseService,
  type PurchasePaginationQuery,
} from './store-purchase.service';

@Roles(UserRole.ADMIN, UserRole.RECEPTIONIST)
@Controller('store/purchases')
export class StorePurchaseController {
  constructor(private readonly purchaseService: StorePurchaseService) {}

  @Post()
  create(
    @Headers('x-business-id') businessId: string,
    @Body() dto: CreatePurchaseDto,
    @CurrentUser() currentUser: AuthUser,
  ) {
    return this.purchaseService.create(
      dto,
      businessId,
      currentUser.userId,
      currentUser.role,
    );
  }

  @Get()
  findAll(
    @Headers('x-business-id') businessId: string,
    @Query() query: PurchasePaginationQuery,
    @CurrentUser() currentUser: AuthUser,
  ) {
    return this.purchaseService.findAll(
      businessId,
      query,
      currentUser.userId,
      currentUser.role,
    );
  }

  @Get(':id')
  findOne(
    @Headers('x-business-id') businessId: string,
    @Param('id') id: string,
    @CurrentUser() currentUser: AuthUser,
  ) {
    return this.purchaseService.findOne(
      id,
      businessId,
      currentUser.userId,
      currentUser.role,
    );
  }

  @Patch(':id')
  update(
    @Headers('x-business-id') businessId: string,
    @Param('id') id: string,
    @Body() dto: UpdatePurchaseDto,
    @CurrentUser() currentUser: AuthUser,
  ) {
    return this.purchaseService.update(
      id,
      dto,
      businessId,
      currentUser.userId,
      currentUser.role,
    );
  }

  @Patch(':id/complete')
  complete(
    @Headers('x-business-id') businessId: string,
    @Param('id') id: string,
    @CurrentUser() currentUser: AuthUser,
  ) {
    return this.purchaseService.complete(
      id,
      businessId,
      currentUser.userId,
      currentUser.role,
    );
  }

  @Patch(':id/cancel')
  cancel(
    @Headers('x-business-id') businessId: string,
    @Param('id') id: string,
    @CurrentUser() currentUser: AuthUser,
  ) {
    return this.purchaseService.cancel(
      id,
      businessId,
      currentUser.userId,
      currentUser.role,
    );
  }
}
