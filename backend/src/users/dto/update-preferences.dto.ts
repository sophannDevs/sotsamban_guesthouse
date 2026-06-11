import { IsEnum } from 'class-validator';

import { PreferredLanguage } from '../../../generated/prisma/client';

export class UpdatePreferencesDto {
  @IsEnum(PreferredLanguage)
  preferredLanguage!: PreferredLanguage;
}
