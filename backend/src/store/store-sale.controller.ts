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
import { CreateSaleDto } from './dto/create-sale.dto';
import {
  StoreSaleService,
  type SalePaginationQuery,
} from './store-sale.service';

@Roles(UserRole.ADMIN, UserRole.RECEPTIONIST)
@Controller('store/sales')
export class StoreSaleController {
  constructor(private readonly saleService: StoreSaleService) {}

  @Post()
  create(
    @Headers('x-business-id') businessId: string,
    @Body() dto: CreateSaleDto,
    @CurrentUser() currentUser: AuthUser,
  ) {
    return this.saleService.create(
      dto,
      businessId,
      currentUser.userId,
      currentUser.role,
    );
  }

  @Get()
  findAll(
    @Headers('x-business-id') businessId: string,
    @Query() query: SalePaginationQuery,
    @CurrentUser() currentUser: AuthUser,
  ) {
    return this.saleService.findAll(
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
    return this.saleService.findOne(
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
    return this.saleService.cancel(
      id,
      businessId,
      currentUser.userId,
      currentUser.role,
    );
  }

  @Patch(':id/refund')
  refund(
    @Headers('x-business-id') businessId: string,
    @Param('id') id: string,
    @CurrentUser() currentUser: AuthUser,
  ) {
    return this.saleService.refund(
      id,
      businessId,
      currentUser.userId,
      currentUser.role,
    );
  }
}
