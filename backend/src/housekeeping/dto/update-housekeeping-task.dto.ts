import { IsEnum, IsOptional, IsString } from 'class-validator';

import { HousekeepingPriority } from '../../../generated/prisma/client';

export class UpdateHousekeepingTaskDto {
  @IsString()
  @IsOptional()
  assignedToId?: string | null;

  @IsEnum(HousekeepingPriority)
  @IsOptional()
  priority?: HousekeepingPriority;

  @IsString()
  @IsOptional()
  note?: string | null;
}
