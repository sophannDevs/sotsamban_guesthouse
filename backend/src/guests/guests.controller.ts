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
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import type { AuthUser } from '../auth/types';
import { apiResponse } from '../common/api-response';
import type { PaginationQuery } from '../common/pagination';
import { CreateGuestDto } from './dto/create-guest.dto';
import { UpdateGuestDto } from './dto/update-guest.dto';
import { GuestsService } from './guests.service';

@Roles(UserRole.ADMIN, UserRole.RECEPTIONIST)
@Controller('guests')
export class GuestsController {
  constructor(private readonly guestsService: GuestsService) {}

  @Post()
  async create(
    @Body() createGuestDto: CreateGuestDto,
    @Headers('x-business-id') businessId: string,
    @CurrentUser() currentUser: AuthUser,
  ) {
    const guest = await this.guestsService.create(
      businessId,
      currentUser,
      createGuestDto,
    );

    return apiResponse('Guest created successfully.', guest);
  }

  @Get()
  async findAll(
    @Query() query: PaginationQuery,
    @Headers('x-business-id') businessId: string,
    @CurrentUser() currentUser: AuthUser,
  ) {
    const guests = await this.guestsService.findAll(
      businessId,
      currentUser,
      query,
    );

    return guests;
  }

  @Get('search')
  async search(
    @Query('query') query: string,
    @Query('limit') limit: string | undefined,
    @Headers('x-business-id') businessId: string,
    @CurrentUser() currentUser: AuthUser,
  ) {
    return this.guestsService.search(
      businessId,
      currentUser,
      query,
      limit ? Number(limit) : undefined,
    );
  }

  @Get('frequent')
  async getFrequent(
    @Query('limit') limit: string | undefined,
    @Headers('x-business-id') businessId: string,
    @CurrentUser() currentUser: AuthUser,
  ) {
    return this.guestsService.getFrequent(
      businessId,
      currentUser,
      limit ? Number(limit) : undefined,
    );
  }

  @Get(':id')
  async findOne(
    @Param('id') id: string,
    @Headers('x-business-id') businessId: string,
    @CurrentUser() currentUser: AuthUser,
  ) {
    const guest = await this.guestsService.findOne(id, businessId, currentUser);

    return apiResponse('Guest retrieved successfully.', guest);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() updateGuestDto: UpdateGuestDto,
    @Headers('x-business-id') businessId: string,
    @CurrentUser() currentUser: AuthUser,
  ) {
    const guest = await this.guestsService.update(
      id,
      businessId,
      currentUser,
      updateGuestDto,
    );

    return apiResponse('Guest updated successfully.', guest);
  }

  @Delete(':id')
  async remove(
    @Param('id') id: string,
    @Headers('x-business-id') businessId: string,
    @CurrentUser() currentUser: AuthUser,
  ) {
    const guest = await this.guestsService.remove(id, businessId, currentUser);

    return apiResponse('Guest deleted successfully.', guest);
  }
}
