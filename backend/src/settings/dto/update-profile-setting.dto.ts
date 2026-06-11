import { IsEnum, IsOptional, IsString } from 'class-validator';

import { PreferredLanguage } from '../../../generated/prisma/client';

export class UpdateProfileSettingDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsEnum(PreferredLanguage)
  preferredLanguage?: PreferredLanguage;
}
