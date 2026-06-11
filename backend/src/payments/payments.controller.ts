import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';

import { PaymentStatus, UserRole } from '../../generated/prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import type { AuthUser } from '../auth/types';
import { apiResponse } from '../common/api-response';
import type { PaginationQuery } from '../common/pagination';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { UpdatePaymentDto } from './dto/update-payment.dto';
import { PaymentsService } from './payments.service';

@Roles(UserRole.ADMIN, UserRole.RECEPTIONIST)
@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post()
  async create(
    @Body() createPaymentDto: CreatePaymentDto,
    @CurrentUser() currentUser: AuthUser,
  ) {
    const payment = await this.paymentsService.create(
      createPaymentDto,
      currentUser.userId,
    );

    return apiResponse('Payment created successfully.', payment);
  }

  @Get()
  async findAll(@Query() query: PaginationQuery & { status?: PaymentStatus }) {
    const payments = await this.paymentsService.findAll(query);

    return payments;
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const payment = await this.paymentsService.findOne(id);

    return apiResponse('Payment retrieved successfully.', payment);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() updatePaymentDto: UpdatePaymentDto,
    @CurrentUser() currentUser: AuthUser,
  ) {
    const payment = await this.paymentsService.update(
      id,
      updatePaymentDto,
      currentUser.userId,
    );

    return apiResponse('Payment updated successfully.', payment);
  }
}
