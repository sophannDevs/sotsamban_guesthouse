import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

import {
  BookingType,
  CoolingOption,
  SessionType,
  StayDuration,
} from '../../../generated/prisma/client';

export class WalkInGuestDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  phone?: string;
}

export class WalkInCheckInDto {
  @ValidateNested()
  @Type(() => WalkInGuestDto)
  guest: WalkInGuestDto;

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
