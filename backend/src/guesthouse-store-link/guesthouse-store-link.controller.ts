import { Body, Controller, Delete, Get, Headers, Post } from '@nestjs/common';

import { UserRole } from '../../generated/prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import type { AuthUser } from '../auth/types';
import { CreateStoreLinkDto } from './dto/create-store-link.dto';
import { GuesthouseStoreLinkService } from './guesthouse-store-link.service';

@Roles(UserRole.ADMIN, UserRole.RECEPTIONIST)
@Controller('guesthouse/store-link')
export class GuesthouseStoreLinkController {
  constructor(private readonly storeLinkService: GuesthouseStoreLinkService) {}

  @Get('stores')
  listEligibleStores(@CurrentUser() currentUser: AuthUser) {
    return this.storeLinkService.listEligibleStores(
      currentUser.userId,
      currentUser.role,
    );
  }

  @Post()
  create(
    @Headers('x-business-id') businessId: string,
    @Body() dto: CreateStoreLinkDto,
    @CurrentUser() currentUser: AuthUser,
  ) {
    return this.storeLinkService.create(
      dto,
      businessId,
      currentUser.userId,
      currentUser.role,
    );
  }

  @Get()
  findOne(
    @Headers('x-business-id') businessId: string,
    @CurrentUser() currentUser: AuthUser,
  ) {
    return this.storeLinkService.findOne(
      businessId,
      currentUser.userId,
      currentUser.role,
    );
  }

  @Delete()
  remove(
    @Headers('x-business-id') businessId: string,
    @CurrentUser() currentUser: AuthUser,
  ) {
    return this.storeLinkService.remove(
      businessId,
      currentUser.userId,
      currentUser.role,
    );
  }
}
