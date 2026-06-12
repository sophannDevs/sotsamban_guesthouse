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
import type { PaginationQuery } from '../common/pagination';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { StoreCategoryService } from './store-category.service';

@Roles(UserRole.ADMIN, UserRole.RECEPTIONIST)
@Controller('store/categories')
export class StoreCategoryController {
  constructor(private readonly categoryService: StoreCategoryService) {}

  @Post()
  create(
    @Headers('x-business-id') businessId: string,
    @Body() dto: CreateCategoryDto,
    @CurrentUser() currentUser: AuthUser,
  ) {
    return this.categoryService.create(
      dto,
      businessId,
      currentUser.userId,
      currentUser.role,
    );
  }

  @Get()
  findAll(
    @Headers('x-business-id') businessId: string,
    @Query() query: PaginationQuery,
    @CurrentUser() currentUser: AuthUser,
  ) {
    return this.categoryService.findAll(
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
    return this.categoryService.findOne(
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
    @Body() dto: UpdateCategoryDto,
    @CurrentUser() currentUser: AuthUser,
  ) {
    return this.categoryService.update(
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
    return this.categoryService.remove(
      id,
      businessId,
      currentUser.userId,
      currentUser.role,
    );
  }
}
