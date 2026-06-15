import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
} from 'class-validator';

import {
  ExpenseCategory,
  ExpensePaymentMethod,
} from '../../../generated/prisma/client';

export class CreateExpenseDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title: string;

  @IsEnum(ExpenseCategory, {
    message: `category must be one of: ${Object.values(ExpenseCategory).join(', ')}`,
  })
  category: ExpenseCategory;

  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  amount: number;

  @IsDateString()
  expenseDate: string;

  @IsEnum(ExpensePaymentMethod, {
    message: `paymentMethod must be one of: ${Object.values(ExpensePaymentMethod).join(', ')}`,
  })
  paymentMethod: ExpensePaymentMethod;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
