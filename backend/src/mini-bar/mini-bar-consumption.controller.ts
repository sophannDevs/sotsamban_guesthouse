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
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import type { AuthUser } from '../auth/types';
import { CreateMiniBarConsumptionDto } from './dto/create-mini-bar-consumption.dto';
import { UpdateMiniBarConsumptionDto } from './dto/update-mini-bar-consumption.dto';
import {
  MiniBarConsumptionService,
  type MiniBarConsumptionPaginationQuery,
} from './mini-bar-consumption.service';

@Roles(UserRole.ADMIN, UserRole.RECEPTIONIST)
@Controller('mini-bar/consumptions')
export class MiniBarConsumptionController {
  constructor(private readonly consumptionService: MiniBarConsumptionService) {}

  @Post()
  create(
    @Headers('x-business-id') businessId: string,
    @Body() dto: CreateMiniBarConsumptionDto,
    @CurrentUser() currentUser: AuthUser,
  ) {
    return this.consumptionService.create(
      dto,
      businessId,
      currentUser.userId,
      currentUser.role,
    );
  }

  @Get('products')
  listEligibleProducts(
    @Headers('x-business-id') businessId: string,
    @CurrentUser() currentUser: AuthUser,
  ) {
    return this.consumptionService.listEligibleProducts(
      businessId,
      currentUser.userId,
      currentUser.role,
    );
  }

  @Get()
  findAll(
    @Headers('x-business-id') businessId: string,
    @Query() query: MiniBarConsumptionPaginationQuery,
    @CurrentUser() currentUser: AuthUser,
  ) {
    return this.consumptionService.findAll(
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
    return this.consumptionService.findOne(
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
    @Body() dto: UpdateMiniBarConsumptionDto,
    @CurrentUser() currentUser: AuthUser,
  ) {
    return this.consumptionService.update(
      id,
      dto,
      businessId,
      currentUser.userId,
      currentUser.role,
    );
  }

  @Patch(':id/charge')
  charge(
    @Headers('x-business-id') businessId: string,
    @Param('id') id: string,
    @CurrentUser() currentUser: AuthUser,
  ) {
    return this.consumptionService.charge(
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
    return this.consumptionService.cancel(
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
    return this.consumptionService.refund(
      id,
      businessId,
      currentUser.userId,
      currentUser.role,
    );
  }
}
