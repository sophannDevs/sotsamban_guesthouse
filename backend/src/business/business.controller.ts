import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';

import { UserRole } from '../../generated/prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import type { AuthUser } from '../auth/types';
import { apiResponse } from '../common/api-response';
import type { PaginationQuery } from '../common/pagination';
import { BusinessService } from './business.service';
import { CreateBusinessDto } from './dto/create-business.dto';
import { UpdateBusinessDto } from './dto/update-business.dto';

@Roles(UserRole.ADMIN, UserRole.RECEPTIONIST)
@Controller('businesses')
export class BusinessController {
  constructor(private readonly businessService: BusinessService) {}

  @Post()
  async create(
    @Body() createBusinessDto: CreateBusinessDto,
    @CurrentUser() currentUser: AuthUser,
  ) {
    const business = await this.businessService.create(
      createBusinessDto,
      currentUser.userId,
    );

    return apiResponse('Business created successfully.', business);
  }

  @Get()
  async findAll(
    @Query() query: PaginationQuery,
    @CurrentUser() currentUser: AuthUser,
  ) {
    return this.businessService.findAll(
      query,
      currentUser.userId,
      currentUser.role,
    );
  }

  @Post(':id/switch')
  async switchBusiness(
    @Param('id') id: string,
    @CurrentUser() currentUser: AuthUser,
  ) {
    const result = await this.businessService.switchTo(
      id,
      currentUser.userId,
      currentUser.role,
    );

    return apiResponse('Switched to business successfully.', result);
  }

  @Get(':id')
  async findOne(
    @Param('id') id: string,
    @CurrentUser() currentUser: AuthUser,
  ) {
    const business = await this.businessService.findOne(
      id,
      currentUser.userId,
      currentUser.role,
    );

    return apiResponse('Business retrieved successfully.', business);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() updateBusinessDto: UpdateBusinessDto,
    @CurrentUser() currentUser: AuthUser,
  ) {
    const business = await this.businessService.update(
      id,
      updateBusinessDto,
      currentUser.userId,
    );

    return apiResponse('Business updated successfully.', business);
  }

  @Delete(':id')
  async remove(
    @Param('id') id: string,
    @CurrentUser() currentUser: AuthUser,
  ) {
    const business = await this.businessService.remove(
      id,
      currentUser.userId,
    );

    return apiResponse('Business deleted successfully.', business);
  }
}
