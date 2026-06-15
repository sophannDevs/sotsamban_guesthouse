import { Controller, Get, Headers, Query } from '@nestjs/common';

import { UserRole } from '../../generated/prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import type { AuthUser } from '../auth/types';
import { apiResponse } from '../common/api-response';
import { FinanceService } from './finance.service';

@Roles(UserRole.ADMIN, UserRole.RECEPTIONIST)
@Controller('finance')
export class FinanceController {
  constructor(private readonly financeService: FinanceService) {}

  @Get('summary')
  async getSummary(
    @Headers('x-business-id') businessId: string,
    @Query('rangePreset') rangePreset?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @CurrentUser() currentUser?: AuthUser,
  ) {
    const summary = await this.financeService.getSummary(
      businessId,
      { rangePreset, startDate, endDate },
      currentUser!,
    );
    return apiResponse('Finance summary retrieved successfully.', summary);
  }

  @Get('summary/all-businesses')
  async getAllBusinessesSummary(
    @Query('rangePreset') rangePreset?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @CurrentUser() currentUser?: AuthUser,
  ) {
    const summary = await this.financeService.getAllBusinessesSummary(
      { rangePreset, startDate, endDate },
      currentUser!,
    );
    return apiResponse(
      'All-businesses finance summary retrieved successfully.',
      summary,
    );
  }
}
