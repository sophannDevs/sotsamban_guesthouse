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

import {
  ExpenseCategory,
  ExpensePaymentMethod,
  UserRole,
} from '../../generated/prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import type { AuthUser } from '../auth/types';
import { apiResponse } from '../common/api-response';
import type { PaginationQuery } from '../common/pagination';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { UpdateExpenseDto } from './dto/update-expense.dto';
import { ExpenseService } from './expense.service';

type ExpensePaginationQuery = PaginationQuery & {
  startDate?: string;
  endDate?: string;
  category?: ExpenseCategory;
  paymentMethod?: ExpensePaymentMethod;
};

@Roles(UserRole.ADMIN, UserRole.RECEPTIONIST)
@Controller('expenses')
export class ExpenseController {
  constructor(private readonly expenseService: ExpenseService) {}

  @Roles(UserRole.ADMIN)
  @Post()
  async create(
    @Headers('x-business-id') businessId: string,
    @Body() dto: CreateExpenseDto,
    @CurrentUser() currentUser: AuthUser,
  ) {
    const expense = await this.expenseService.create(dto, businessId, currentUser);
    return apiResponse('Expense created successfully.', expense);
  }

  @Get()
  async findAll(
    @Headers('x-business-id') businessId: string,
    @Query() query: ExpensePaginationQuery,
    @CurrentUser() currentUser: AuthUser,
  ) {
    return this.expenseService.findAll(query, businessId, currentUser);
  }

  @Get(':id')
  async findOne(
    @Headers('x-business-id') businessId: string,
    @Param('id') id: string,
    @CurrentUser() currentUser: AuthUser,
  ) {
    const expense = await this.expenseService.findOne(id, businessId, currentUser);
    return apiResponse('Expense retrieved successfully.', expense);
  }

  @Roles(UserRole.ADMIN)
  @Patch(':id')
  async update(
    @Headers('x-business-id') businessId: string,
    @Param('id') id: string,
    @Body() dto: UpdateExpenseDto,
    @CurrentUser() currentUser: AuthUser,
  ) {
    const expense = await this.expenseService.update(id, dto, businessId, currentUser);
    return apiResponse('Expense updated successfully.', expense);
  }

  @Roles(UserRole.ADMIN)
  @Delete(':id')
  async remove(
    @Headers('x-business-id') businessId: string,
    @Param('id') id: string,
    @CurrentUser() currentUser: AuthUser,
  ) {
    const expense = await this.expenseService.remove(id, businessId, currentUser);
    return apiResponse('Expense deleted successfully.', expense);
  }
}
