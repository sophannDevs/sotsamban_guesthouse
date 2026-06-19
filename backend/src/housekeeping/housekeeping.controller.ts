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
import { CreateHousekeepingTaskDto } from './dto/create-housekeeping-task.dto';
import { UpdateHousekeepingTaskDto } from './dto/update-housekeeping-task.dto';
import {
  HousekeepingService,
  type HousekeepingTaskQuery,
} from './housekeeping.service';

@Roles(UserRole.ADMIN, UserRole.RECEPTIONIST)
@Controller('housekeeping/tasks')
export class HousekeepingController {
  constructor(private readonly housekeepingService: HousekeepingService) {}

  @Post()
  async create(
    @Headers('x-business-id') businessId: string,
    @Body() dto: CreateHousekeepingTaskDto,
    @CurrentUser() currentUser: AuthUser,
  ) {
    const task = await this.housekeepingService.create(
      dto,
      businessId,
      currentUser,
    );
    return apiResponse('Housekeeping task created.', task);
  }

  @Get()
  findAll(
    @Headers('x-business-id') businessId: string,
    @Query() query: PaginationQuery & HousekeepingTaskQuery,
    @CurrentUser() currentUser: AuthUser,
  ) {
    return this.housekeepingService.findAll(businessId, query, currentUser);
  }

  @Get(':id')
  async findOne(
    @Headers('x-business-id') businessId: string,
    @Param('id') id: string,
    @CurrentUser() currentUser: AuthUser,
  ) {
    const task = await this.housekeepingService.findOne(
      id,
      businessId,
      currentUser,
    );
    return apiResponse('Housekeeping task retrieved.', task);
  }

  @Patch(':id')
  async update(
    @Headers('x-business-id') businessId: string,
    @Param('id') id: string,
    @Body() dto: UpdateHousekeepingTaskDto,
    @CurrentUser() currentUser: AuthUser,
  ) {
    const task = await this.housekeepingService.update(
      id,
      dto,
      businessId,
      currentUser,
    );
    return apiResponse('Housekeeping task updated.', task);
  }

  @Patch(':id/start')
  async start(
    @Headers('x-business-id') businessId: string,
    @Param('id') id: string,
    @CurrentUser() currentUser: AuthUser,
  ) {
    const task = await this.housekeepingService.start(
      id,
      businessId,
      currentUser,
    );
    return apiResponse('Housekeeping task started.', task);
  }

  @Patch(':id/complete')
  async complete(
    @Headers('x-business-id') businessId: string,
    @Param('id') id: string,
    @CurrentUser() currentUser: AuthUser,
  ) {
    const task = await this.housekeepingService.complete(
      id,
      businessId,
      currentUser,
    );
    return apiResponse('Housekeeping task completed.', task);
  }

  @Patch(':id/inspect')
  async inspect(
    @Headers('x-business-id') businessId: string,
    @Param('id') id: string,
    @CurrentUser() currentUser: AuthUser,
  ) {
    const task = await this.housekeepingService.inspect(
      id,
      businessId,
      currentUser,
    );
    return apiResponse('Housekeeping task inspected.', task);
  }

  @Patch(':id/cancel')
  async cancel(
    @Headers('x-business-id') businessId: string,
    @Param('id') id: string,
    @CurrentUser() currentUser: AuthUser,
  ) {
    const task = await this.housekeepingService.cancel(
      id,
      businessId,
      currentUser,
    );
    return apiResponse('Housekeeping task cancelled.', task);
  }

  @Delete(':id')
  async remove(
    @Headers('x-business-id') businessId: string,
    @Param('id') id: string,
    @CurrentUser() currentUser: AuthUser,
  ) {
    const task = await this.housekeepingService.remove(
      id,
      businessId,
      currentUser,
    );
    return apiResponse('Housekeeping task deleted.', task);
  }
}
