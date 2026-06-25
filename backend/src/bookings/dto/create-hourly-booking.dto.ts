import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';

import {
  BookingType,
  CoolingOption,
  SessionType,
  StayDuration,
} from '../../../generated/prisma/client';

export class CreateHourlyBookingDto {
  @IsString()
  @IsNotEmpty()
  guestId: string;

  @IsString()
  @IsNotEmpty()
  roomId: string;

  @IsEnum(BookingType)
  bookingType: BookingType;

  @IsEnum(StayDuration)
  @IsOptional()
  stayDuration?: StayDuration;

  @IsEnum(SessionType)
  sessionType: SessionType;

  @IsEnum(CoolingOption)
  coolingOption: CoolingOption;
}

export class PreviewHourlyBookingPriceDto {
  @IsString()
  @IsNotEmpty()
  roomId: string;

  @IsEnum(BookingType)
  bookingType: BookingType;

  @IsEnum(StayDuration)
  @IsOptional()
  stayDuration?: StayDuration;

  @IsEnum(SessionType)
  sessionType: SessionType;

  @IsEnum(CoolingOption)
  coolingOption: CoolingOption;
}
