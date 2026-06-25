import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';

import {
  Business,
  BusinessType,
  UserRole,
} from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Requires the x-business-id header to reference an existing GUESTHOUSE
 * business that the current user is either a system ADMIN or a member of.
 */
export async function assertGuesthouseAccess(
  prisma: PrismaService,
  businessId: string,
  userId: string,
  userRole: UserRole,
): Promise<Business> {
  if (!businessId) {
    throw new BadRequestException('x-business-id header is required.');
  }

  const business = await prisma.business.findUnique({
    where: { id: businessId },
  });

  if (!business) {
    throw new NotFoundException('Business not found.');
  }

  if (business.type !== BusinessType.GUESTHOUSE) {
    throw new ForbiddenException(
      'This endpoint is only available for GUESTHOUSE businesses.',
    );
  }

  if (userRole !== UserRole.ADMIN) {
    const member = await prisma.businessMember.findUnique({
      where: { businessId_userId: { businessId, userId } },
    });

    if (!member) {
      throw new ForbiddenException('You are not a member of this business.');
    }
  }

  return business;
}
