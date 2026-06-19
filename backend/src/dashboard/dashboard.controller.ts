import { Controller, Get } from '@nestjs/common';

import { UserRole } from '../../generated/prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { apiResponse } from '../common/api-response';
import { DashboardService } from './dashboard.service';

@Roles(UserRole.ADMIN, UserRole.RECEPTIONIST)
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('summary')
  async getSummary() {
    const summary = await this.dashboardService.getSummary();

    return apiResponse('Dashboard summary retrieved successfully.', summary);
  }

  @Get('recent-bookings')
  async getRecentBookings() {
    const bookings = await this.dashboardService.getRecentBookings();

    return apiResponse('Recent bookings retrieved successfully.', bookings);
  }

  @Get('recent-payments')
  async getRecentPayments() {
    const payments = await this.dashboardService.getRecentPayments();

    return apiResponse('Recent payments retrieved successfully.', payments);
  }

  @Get('housekeeping-summary')
  async getHousekeepingSummary() {
    const summary = await this.dashboardService.getHousekeepingSummary();

    return apiResponse('Housekeeping summary retrieved successfully.', summary);
  }
}
