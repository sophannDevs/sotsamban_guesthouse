import { IsIn } from 'class-validator';

import { BusinessRole } from '../../../generated/prisma/client';

const assignableRoles = [BusinessRole.ADMIN, BusinessRole.STAFF] as const;

export class UpdateMemberRoleDto {
  @IsIn(assignableRoles, {
    message: `role must be one of: ${assignableRoles.join(', ')}`,
  })
  role: (typeof assignableRoles)[number];
}
