import {
  Body,
  Controller,
  Delete,
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
import { CreateSupplierDto } from './dto/create-supplier.dto';
import {
  StoreSupplierService,
  type SupplierPaginationQuery,
} from './store-supplier.service';

@Roles(UserRole.ADMIN, UserRole.RECEPTIONIST)
@Controller('store/suppliers')
export class StoreSupplierController {
  constructor(private readonly supplierService: StoreSupplierService) {}

  @Post()
  create(
    @Headers('x-business-id') businessId: string,
    @Body() dto: CreateSupplierDto,
    @CurrentUser() currentUser: AuthUser,
  ) {
    return this.supplierService.create(
      dto,
      businessId,
      currentUser.userId,
      currentUser.role,
    );
  }

  @Get()
  findAll(
    @Headers('x-business-id') businessId: string,
    @Query() query: SupplierPaginationQuery,
    @CurrentUser() currentUser: AuthUser,
  ) {
    return this.supplierService.findAll(
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
    return this.supplierService.findOne(
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
    @Body() dto: CreateSupplierDto,
    @CurrentUser() currentUser: AuthUser,
  ) {
    return this.supplierService.update(
      id,
      dto,
      businessId,
      currentUser.userId,
      currentUser.role,
    );
  }

  @Delete(':id')
  remove(
    @Headers('x-business-id') businessId: string,
    @Param('id') id: string,
    @CurrentUser() currentUser: AuthUser,
  ) {
    return this.supplierService.remove(
      id,
      businessId,
      currentUser.userId,
      currentUser.role,
    );
  }
}
