import { IsEnum, IsNotEmpty, IsNumber, IsString, Min } from 'class-validator';

import { RoomStatus, RoomType } from '../../../generated/prisma/client';

export class CreateRoomDto {
  @IsString()
  @IsNotEmpty()
  roomNumber: string;

  @IsEnum(RoomType)
  type: RoomType;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  pricePerNight: number;

  @IsEnum(RoomStatus)
  status: RoomStatus;
}
