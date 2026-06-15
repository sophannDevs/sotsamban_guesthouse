import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import {
  ExpenseCategory,
  ExpensePaymentMethod,
  Prisma,
  UserRole,
} from '../../generated/prisma/client';
import type { AuthUser } from '../auth/types';
import {
  createPaginatedResult,
  getPaginationOptions,
  PaginationQuery,
} from '../common/pagination';
import { PrismaService } from '../prisma/prisma.service';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { UpdateExpenseDto } from './dto/update-expense.dto';

export type ExpensePaginationQuery = PaginationQuery & {
  startDate?: string;
  endDate?: string;
  category?: ExpenseCategory;
  paymentMethod?: ExpensePaymentMethod;
};

const expenseSortFields = [
  'createdAt',
  'updatedAt',
  'expenseDate',
  'amount',
  'title',
] as const;

type ExpenseWithRelations = Prisma.ExpenseGetPayload<{
  include: { createdBy: { select: { id: true; name: true; email: true } } };
}>;

@Injectable()
export class ExpenseService {
  constructor(private readonly prisma: PrismaService) {}

  private readonly expenseInclude = {
    createdBy: { select: { id: true, name: true, email: true } },
  } satisfies Prisma.ExpenseInclude;

  private async validateBusinessAccess(
    businessId: string | undefined,
    userId: string,
    userRole: UserRole,
  ) {
    if (!businessId) {
      throw new BadRequestException('x-business-id header is required.');
    }
    const business = await this.prisma.business.findUnique({
      where: { id: businessId },
    });
    if (!business) {
      throw new NotFoundException('Business not found.');
    }
    if (userRole !== UserRole.ADMIN) {
      const member = await this.prisma.businessMember.findUnique({
        where: { businessId_userId: { businessId, userId } },
      });
      if (!member) {
        throw new ForbiddenException('You are not a member of this business.');
      }
    }
    return business;
  }

  async create(
    dto: CreateExpenseDto,
    businessId: string | undefined,
    currentUser: AuthUser,
  ) {
    await this.validateBusinessAccess(
      businessId,
      currentUser.userId,
      currentUser.role,
    );

    const expense = await this.prisma.expense.create({
      data: {
        businessId: businessId!,
        title: dto.title,
        category: dto.category,
        amount: dto.amount,
        expenseDate: new Date(dto.expenseDate),
        paymentMethod: dto.paymentMethod,
        note: dto.note,
        createdById: currentUser.userId,
      },
      include: this.expenseInclude,
    });

    return this.serialize(expense);
  }

  async findAll(
    query: ExpensePaginationQuery,
    businessId: string | undefined,
    currentUser: AuthUser,
  ) {
    await this.validateBusinessAccess(
      businessId,
      currentUser.userId,
      currentUser.role,
    );

    const pagination = getPaginationOptions(query, {
      allowedSortBy: expenseSortFields,
      defaultSortBy: 'createdAt',
    });

    const where: Prisma.ExpenseWhereInput = { businessId: businessId! };

    if (query.startDate || query.endDate) {
      where.expenseDate = {
        ...(query.startDate ? { gte: new Date(query.startDate) } : {}),
        ...(query.endDate
          ? {
              lte: new Date(
                new Date(query.endDate).setHours(23, 59, 59, 999),
              ),
            }
          : {}),
      };
    }

    if (query.category) {
      where.category = query.category;
    }

    if (query.paymentMethod) {
      where.paymentMethod = query.paymentMethod;
    }

    if (pagination.search) {
      where.title = { contains: pagination.search, mode: 'insensitive' };
    }

    const [data, total] = await Promise.all([
      this.prisma.expense.findMany({
        where,
        include: this.expenseInclude,
        orderBy: { [pagination.sortBy]: pagination.sortOrder },
        skip: pagination.skip,
        take: pagination.limit,
      }),
      this.prisma.expense.count({ where }),
    ]);

    return createPaginatedResult(
      data.map((e) => this.serialize(e)),
      total,
      pagination,
    );
  }

  async findOne(
    id: string,
    businessId: string | undefined,
    currentUser: AuthUser,
  ) {
    await this.validateBusinessAccess(
      businessId,
      currentUser.userId,
      currentUser.role,
    );

    const expense = await this.prisma.expense.findFirst({
      where: { id, businessId: businessId! },
      include: this.expenseInclude,
    });

    if (!expense) {
      throw new NotFoundException('Expense not found.');
    }

    return this.serialize(expense);
  }

  async update(
    id: string,
    dto: UpdateExpenseDto,
    businessId: string | undefined,
    currentUser: AuthUser,
  ) {
    await this.validateBusinessAccess(
      businessId,
      currentUser.userId,
      currentUser.role,
    );

    const existing = await this.prisma.expense.findFirst({
      where: { id, businessId: businessId! },
    });
    if (!existing) {
      throw new NotFoundException('Expense not found.');
    }

    const updated = await this.prisma.expense.update({
      where: { id },
      data: {
        ...(dto.title !== undefined ? { title: dto.title } : {}),
        ...(dto.category !== undefined ? { category: dto.category } : {}),
        ...(dto.amount !== undefined ? { amount: dto.amount } : {}),
        ...(dto.expenseDate !== undefined
          ? { expenseDate: new Date(dto.expenseDate) }
          : {}),
        ...(dto.paymentMethod !== undefined
          ? { paymentMethod: dto.paymentMethod }
          : {}),
        ...(dto.note !== undefined ? { note: dto.note } : {}),
      },
      include: this.expenseInclude,
    });

    return this.serialize(updated);
  }

  async remove(
    id: string,
    businessId: string | undefined,
    currentUser: AuthUser,
  ) {
    await this.validateBusinessAccess(
      businessId,
      currentUser.userId,
      currentUser.role,
    );

    const existing = await this.prisma.expense.findFirst({
      where: { id, businessId: businessId! },
    });
    if (!existing) {
      throw new NotFoundException('Expense not found.');
    }

    const deleted = await this.prisma.expense.delete({
      where: { id },
      include: this.expenseInclude,
    });

    return this.serialize(deleted);
  }

  private serialize(expense: ExpenseWithRelations) {
    return {
      id: expense.id,
      businessId: expense.businessId,
      title: expense.title,
      category: expense.category,
      amount: Number(expense.amount),
      expenseDate: expense.expenseDate,
      paymentMethod: expense.paymentMethod,
      note: expense.note,
      createdBy: expense.createdBy,
      createdAt: expense.createdAt,
      updatedAt: expense.updatedAt,
    };
  }
}
