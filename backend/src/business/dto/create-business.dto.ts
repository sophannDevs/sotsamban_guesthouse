import { IsEnum, IsNotEmpty, IsString, MaxLength } from 'class-validator';

import { BusinessType } from '../../../generated/prisma/client';

export class CreateBusinessDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @IsEnum(BusinessType, {
    message: `type must be one of: ${Object.values(BusinessType).join(', ')}`,
  })
  type: BusinessType;
}
