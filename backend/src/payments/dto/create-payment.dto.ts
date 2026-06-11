import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

import { PaymentMethod, PaymentStatus } from '../../../generated/prisma/client';

export class CreatePaymentDto {
  @IsString()
  @IsNotEmpty()
  bookingId: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount: number;

  @IsEnum(PaymentMethod)
  method: PaymentMethod;

  @IsEnum(PaymentStatus)
  @IsOptional()
  status?: PaymentStatus;
}
