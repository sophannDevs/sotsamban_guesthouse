import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import {
  BusinessRole,
  Prisma,
  UserRole,
} from '../../generated/prisma/client';
import {
  createPaginatedResult,
  getPaginationOptions,
  PaginationQuery,
} from '../common/pagination';
import { PrismaService } from '../prisma/prisma.service';
import { AddMemberDto } from './dto/add-member.dto';
import { UpdateMemberRoleDto } from './dto/update-member-role.dto';

const memberSortFields = ['createdAt', 'updatedAt', 'role'] as const;

type MemberWithRelations = Prisma.BusinessMemberGetPayload<{
  include: {
    user: { select: { id: true; name: true; email: true; phone: true } };
    business: { select: { id: true; name: true; type: true } };
  };
}>;

@Injectable()
export class BusinessMemberService {
  constructor(private readonly prisma: PrismaService) {}

  private readonly memberInclude = {
    user: { select: { id: true, name: true, email: true, phone: true } },
    business: { select: { id: true, name: true, type: true } },
  } satisfies Prisma.BusinessMemberInclude;

  async addMember(
    businessId: string,
    dto: AddMemberDto,
    actorId: string,
    actorUserRole: UserRole,
  ) {
    await this.findBusinessOrThrow(businessId);

    const actorRole = await this.resolveActorRole(businessId, actorId, actorUserRole);

    if (actorRole !== BusinessRole.OWNER && actorRole !== BusinessRole.ADMIN) {
      throw new ForbiddenException(
        'Only business owners and admins can add members.',
      );
    }

    const targetRole = dto.role ?? BusinessRole.STAFF;

    // ADMIN cannot assign roles beyond their own level (defense-in-depth)
    const adminAssignable: readonly BusinessRole[] = [BusinessRole.ADMIN, BusinessRole.STAFF];
    if (actorRole === BusinessRole.ADMIN && !adminAssignable.includes(targetRole)) {
      throw new ForbiddenException('Admins cannot assign the OWNER role.');
    }

    await this.findUserOrThrow(dto.userId);

    try {
      const member = await this.prisma.businessMember.create({
        data: { businessId, userId: dto.userId, role: targetRole },
        include: this.memberInclude,
      });

      return this.serializeMember(member);
    } catch (error) {
      this.handlePrismaError(error);
    }
  }

  async findMembers(
    businessId: string,
    query: PaginationQuery,
    actorId: string,
    actorUserRole: UserRole,
  ) {
    await this.findBusinessOrThrow(businessId);
    await this.resolveActorRole(businessId, actorId, actorUserRole);

    const pagination = getPaginationOptions(query, {
      allowedSortBy: memberSortFields,
      defaultSortBy: 'createdAt',
    });

    const where: Prisma.BusinessMemberWhereInput = { businessId };

    const [data, total] = await Promise.all([
      this.prisma.businessMember.findMany({
        where,
        include: this.memberInclude,
        orderBy: { [pagination.sortBy]: pagination.sortOrder },
        skip: pagination.skip,
        take: pagination.limit,
      }),
      this.prisma.businessMember.count({ where }),
    ]);

    return createPaginatedResult(
      data.map((m) => this.serializeMember(m)),
      total,
      pagination,
    );
  }

  async updateMemberRole(
    businessId: string,
    memberId: string,
    dto: UpdateMemberRoleDto,
    actorId: string,
    actorUserRole: UserRole,
  ) {
    await this.findBusinessOrThrow(businessId);

    const actorRole = await this.resolveActorRole(businessId, actorId, actorUserRole);

    if (actorRole !== BusinessRole.OWNER) {
      throw new ForbiddenException('Only the business owner can change member roles.');
    }

    const member = await this.findMemberOrThrow(memberId, businessId);

    if (member.role === BusinessRole.OWNER) {
      throw new ForbiddenException('The owner role cannot be changed.');
    }

    if (member.userId === actorId) {
      throw new ForbiddenException('You cannot change your own role.');
    }

    const updated = await this.prisma.businessMember.update({
      where: { id: memberId },
      data: { role: dto.role },
      include: this.memberInclude,
    });

    return this.serializeMember(updated);
  }

  async removeMember(
    businessId: string,
    memberId: string,
    actorId: string,
    actorUserRole: UserRole,
  ) {
    await this.findBusinessOrThrow(businessId);

    const actorRole = await this.resolveActorRole(businessId, actorId, actorUserRole);

    if (actorRole === BusinessRole.STAFF) {
      throw new ForbiddenException('Staff members cannot remove members.');
    }

    const member = await this.findMemberOrThrow(memberId, businessId);

    // Rule 4: ADMIN cannot remove OWNER
    if (actorRole === BusinessRole.ADMIN && member.role === BusinessRole.OWNER) {
      throw new ForbiddenException('Admins cannot remove the business owner.');
    }

    // Prevent the OWNER from removing themselves
    if (member.userId === actorId && member.role === BusinessRole.OWNER) {
      throw new ForbiddenException('The business owner cannot remove themselves.');
    }

    const deleted = await this.prisma.businessMember.delete({
      where: { id: memberId },
      include: this.memberInclude,
    });

    return this.serializeMember(deleted);
  }

  /**
   * Returns the actor's BusinessRole within this business.
   * System-level ADMIN is granted OWNER privileges without a membership record.
   * Throws ForbiddenException if the actor is not a member of the business.
   */
  private async resolveActorRole(
    businessId: string,
    actorId: string,
    actorUserRole: UserRole,
  ): Promise<BusinessRole> {
    if (actorUserRole === UserRole.ADMIN) {
      return BusinessRole.OWNER;
    }

    const membership = await this.prisma.businessMember.findUnique({
      where: { businessId_userId: { businessId, userId: actorId } },
    });

    if (!membership) {
      throw new ForbiddenException('You are not a member of this business.');
    }

    return membership.role;
  }

  private async findBusinessOrThrow(id: string) {
    const business = await this.prisma.business.findUnique({ where: { id } });
    if (!business) throw new NotFoundException('Business not found.');
    return business;
  }

  private async findUserOrThrow(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found.');
    return user;
  }

  private async findMemberOrThrow(memberId: string, businessId: string) {
    const member = await this.prisma.businessMember.findFirst({
      where: { id: memberId, businessId },
      include: this.memberInclude,
    });
    if (!member) throw new NotFoundException('Member not found.');
    return member;
  }

  private handlePrismaError(error: unknown): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        throw new ConflictException('User is already a member of this business.');
      }
    }
    throw error;
  }

  private serializeMember(member: MemberWithRelations) {
    return {
      id: member.id,
      businessId: member.businessId,
      userId: member.userId,
      role: member.role,
      user: member.user,
      business: member.business,
      createdAt: member.createdAt,
      updatedAt: member.updatedAt,
    };
  }
}
