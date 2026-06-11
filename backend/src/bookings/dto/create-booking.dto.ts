import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';

import { BookingStatus } from '../../../generated/prisma/client';

export class CreateBookingDto {
  @IsString()
  @IsNotEmpty()
  guestId: string;

  @IsString()
  @IsNotEmpty()
  roomId: string;

  @IsDateString()
  checkInDate: string;

  @IsDateString()
  checkOutDate: string;

  @IsEnum(BookingStatus)
  @IsOptional()
  status?: BookingStatus;
}
