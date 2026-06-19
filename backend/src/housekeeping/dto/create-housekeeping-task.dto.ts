import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';

import {
  HousekeepingPriority,
  HousekeepingStatus,
} from '../../../generated/prisma/client';

export class CreateHousekeepingTaskDto {
  @IsString()
  @IsNotEmpty()
  roomId: string;

  @IsString()
  @IsOptional()
  assignedToId?: string;

  @IsEnum(HousekeepingStatus)
  @IsOptional()
  status?: HousekeepingStatus;

  @IsEnum(HousekeepingPriority)
  @IsOptional()
  priority?: HousekeepingPriority;

  @IsString()
  @IsOptional()
  note?: string;
}
