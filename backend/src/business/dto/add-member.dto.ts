import { IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';

import { BusinessRole } from '../../../generated/prisma/client';

const assignableRoles = [BusinessRole.ADMIN, BusinessRole.STAFF] as const;

export class AddMemberDto {
  @IsString()
  @IsNotEmpty()
  userId: string;

  @IsOptional()
  @IsIn(assignableRoles, {
    message: `role must be one of: ${assignableRoles.join(', ')}`,
  })
  role?: (typeof assignableRoles)[number];
}
