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
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import {
  StoreProductService,
  type ProductPaginationQuery,
} from './store-product.service';

@Roles(UserRole.ADMIN, UserRole.RECEPTIONIST)
@Controller('store/products')
export class StoreProductController {
  constructor(private readonly productService: StoreProductService) {}

  @Post()
  create(
    @Headers('x-business-id') businessId: string,
    @Body() dto: CreateProductDto,
    @CurrentUser() currentUser: AuthUser,
  ) {
    return this.productService.create(
      dto,
      businessId,
      currentUser.userId,
      currentUser.role,
    );
  }

  @Get()
  findAll(
    @Headers('x-business-id') businessId: string,
    @Query() query: ProductPaginationQuery,
    @CurrentUser() currentUser: AuthUser,
  ) {
    return this.productService.findAll(
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
    return this.productService.findOne(
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
    @Body() dto: UpdateProductDto,
    @CurrentUser() currentUser: AuthUser,
  ) {
    return this.productService.update(
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
    return this.productService.remove(
      id,
      businessId,
      currentUser.userId,
      currentUser.role,
    );
  }
}
