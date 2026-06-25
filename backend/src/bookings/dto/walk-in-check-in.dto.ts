import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

import { CoolingOption } from '../../../generated/prisma/client';

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

  @IsDateString()
  checkInDate: string;

  @IsDateString()
  @IsOptional()
  checkOutDate?: string;

  @IsEnum(CoolingOption)
  @IsOptional()
  coolingOption?: CoolingOption;
}
