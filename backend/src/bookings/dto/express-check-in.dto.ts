import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';

import {
  BookingType,
  CoolingOption,
  SessionType,
  StayDuration,
} from '../../../generated/prisma/client';

export class ExpressCheckInDto {
  @IsString()
  @IsNotEmpty()
  guestId: string;

  @IsString()
  @IsNotEmpty()
  roomId: string;

  @IsEnum(BookingType)
  @IsOptional()
  bookingType?: BookingType;

  @IsEnum(StayDuration)
  @IsOptional()
  stayDuration?: StayDuration;

  @IsEnum(SessionType)
  @IsOptional()
  sessionType?: SessionType;

  @IsDateString()
  @IsOptional()
  checkInDate?: string;

  @IsDateString()
  @IsOptional()
  checkOutDate?: string;

  @IsDateString()
  @IsOptional()
  checkInTime?: string;

  @IsEnum(CoolingOption)
  @IsOptional()
  coolingOption?: CoolingOption;
}
