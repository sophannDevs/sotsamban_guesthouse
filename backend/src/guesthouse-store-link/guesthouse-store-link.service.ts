import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import {
  Business,
  BusinessRole,
  BusinessType,
  Prisma,
  UserRole,
} from '../../generated/prisma/client';
import { apiResponse } from '../common/api-response';
import { PrismaService } from '../prisma/prisma.service';
import { CreateStoreLinkDto } from './dto/create-store-link.dto';

type LinkWithStore = Prisma.GuesthouseStoreLinkGetPayload<{
  include: { storeBusiness: { select: { id: true; name: true; type: true } } };
}>;

@Injectable()
export class GuesthouseStoreLinkService {
  constructor(private readonly prisma: PrismaService) {}

  private readonly linkInclude = {
    storeBusiness: { select: { id: true, name: true, type: true } },
  } satisfies Prisma.GuesthouseStoreLinkInclude;

  async create(
    dto: CreateStoreLinkDto,
    guesthouseBusinessId: string,
    userId: string,
    userRole: UserRole,
  ) {
    await this.assertOwnerOrAdmin(
      guesthouseBusinessId,
      BusinessType.GUESTHOUSE,
      userId,
      userRole,
    );
    await this.assertOwnerOrAdmin(
      dto.storeBusinessId,
      BusinessType.STORE,
      userId,
      userRole,
    );

    const link = await this.prisma.guesthouseStoreLink.upsert({
      where: { guesthouseBusinessId },
      update: { storeBusinessId: dto.storeBusinessId },
      create: { guesthouseBusinessId, storeBusinessId: dto.storeBusinessId },
      include: this.linkInclude,
    });

    return apiResponse('Store linked successfully.', this.serialize(link));
  }

  async findOne(guesthouseBusinessId: string, userId: string, userRole: UserRole) {
    await this.assertOwnerOrAdmin(
      guesthouseBusinessId,
      BusinessType.GUESTHOUSE,
      userId,
      userRole,
    );

    const link = await this.prisma.guesthouseStoreLink.findUnique({
      where: { guesthouseBusinessId },
      include: this.linkInclude,
    });

    if (!link) {
      return apiResponse('No store is linked to this guesthouse.', null);
    }

    return apiResponse('Store link retrieved successfully.', this.serialize(link));
  }

  async remove(guesthouseBusinessId: string, userId: string, userRole: UserRole) {
    await this.assertOwnerOrAdmin(
      guesthouseBusinessId,
      BusinessType.GUESTHOUSE,
      userId,
      userRole,
    );

    const link = await this.prisma.guesthouseStoreLink.findUnique({
      where: { guesthouseBusinessId },
      include: this.linkInclude,
    });

    if (!link) {
      throw new NotFoundException('No store is linked to this guesthouse.');
    }

    await this.assertOwnerOrAdmin(
      link.storeBusinessId,
      BusinessType.STORE,
      userId,
      userRole,
    );

    await this.prisma.guesthouseStoreLink.delete({
      where: { guesthouseBusinessId },
    });

    return apiResponse('Store link removed successfully.', this.serialize(link));
  }

  async listEligibleStores(userId: string, userRole: UserRole) {
    const where: Prisma.BusinessWhereInput =
      userRole === UserRole.ADMIN
        ? { type: BusinessType.STORE }
        : {
            type: BusinessType.STORE,
            members: {
              some: {
                userId,
                role: { in: [BusinessRole.OWNER, BusinessRole.ADMIN] },
              },
            },
          };

    const stores = await this.prisma.business.findMany({
      where,
      select: { id: true, name: true, type: true },
      orderBy: { name: 'asc' },
    });

    return apiResponse('Eligible stores retrieved successfully.', stores);
  }

  /**
   * System-level ADMIN is granted OWNER privileges without a membership record,
   * matching the convention used for business member management.
   */
  private async assertOwnerOrAdmin(
    businessId: string,
    expectedType: BusinessType,
    userId: string,
    userRole: UserRole,
  ): Promise<Business> {
    if (!businessId) {
      throw new BadRequestException('x-business-id header is required.');
    }

    const business = await this.prisma.business.findUnique({
      where: { id: businessId },
    });

    if (!business) {
      throw new NotFoundException('Business not found.');
    }

    if (business.type !== expectedType) {
      throw new ForbiddenException(
        `Business ${businessId} must be a ${expectedType} business.`,
      );
    }

    if (userRole === UserRole.ADMIN) {
      return business;
    }

    const membership = await this.prisma.businessMember.findUnique({
      where: { businessId_userId: { businessId, userId } },
    });

    if (
      !membership ||
      (membership.role !== BusinessRole.OWNER &&
        membership.role !== BusinessRole.ADMIN)
    ) {
      throw new ForbiddenException(
        'Only the owner or an admin of this business can manage the mini bar store link.',
      );
    }

    return business;
  }

  private serialize(link: LinkWithStore) {
    return {
      id: link.id,
      guesthouseBusinessId: link.guesthouseBusinessId,
      storeBusinessId: link.storeBusinessId,
      store: link.storeBusiness,
      createdAt: link.createdAt,
      updatedAt: link.updatedAt,
    };
  }
}
