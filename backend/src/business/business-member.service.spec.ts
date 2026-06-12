import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import {
  BusinessRole,
  BusinessType,
  Prisma,
  UserRole,
} from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { BusinessMemberService } from './business-member.service';

// ── fixtures ──────────────────────────────────────────────────────────────────

const mockBusiness = { id: 'biz-1', name: 'Test Biz', type: BusinessType.GUESTHOUSE, ownerId: 'user-owner' };
const mockUser     = { id: 'user-new', name: 'Bob', email: 'bob@example.com', phone: null };

const makeMember = (
  id: string,
  userId: string,
  role: BusinessRole,
): Record<string, unknown> => ({
  id,
  businessId: 'biz-1',
  userId,
  role,
  user:     { id: userId, name: 'X', email: 'x@x.com', phone: null },
  business: { id: 'biz-1', name: 'Test Biz', type: BusinessType.GUESTHOUSE },
  createdAt: new Date('2026-06-12'),
  updatedAt: new Date('2026-06-12'),
});

const ownerMembership  = { id: 'mem-0', businessId: 'biz-1', userId: 'user-owner', role: BusinessRole.OWNER };
const adminMembership  = { id: 'mem-1', businessId: 'biz-1', userId: 'user-admin', role: BusinessRole.ADMIN };
const staffMembership  = { id: 'mem-2', businessId: 'biz-1', userId: 'user-staff', role: BusinessRole.STAFF };

// ── helpers ───────────────────────────────────────────────────────────────────

const memberUniqueWhere = (userId: string) => ({
  businessId_userId: { businessId: 'biz-1', userId },
});

// ── suite ─────────────────────────────────────────────────────────────────────

describe('BusinessMemberService', () => {
  let service: BusinessMemberService;
  let prisma: jest.Mocked<PrismaService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BusinessMemberService,
        {
          provide: PrismaService,
          useValue: {
            business: {
              findUnique: jest.fn(),
            },
            businessMember: {
              create:     jest.fn(),
              findUnique: jest.fn(),
              findFirst:  jest.fn(),
              findMany:   jest.fn(),
              count:      jest.fn(),
              update:     jest.fn(),
              delete:     jest.fn(),
            },
            user: {
              findUnique: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<BusinessMemberService>(BusinessMemberService);
    prisma  = module.get(PrismaService);
  });

  afterEach(() => jest.clearAllMocks());

  // ── addMember ───────────────────────────────────────────────────────────────

  describe('addMember', () => {
    beforeEach(() => {
      (prisma.business.findUnique as jest.Mock).mockResolvedValue(mockBusiness);
      (prisma.user.findUnique     as jest.Mock).mockResolvedValue(mockUser);
    });

    it('OWNER can add a STAFF member', async () => {
      (prisma.businessMember.findUnique as jest.Mock)
        .mockResolvedValueOnce(ownerMembership);
      (prisma.businessMember.create as jest.Mock)
        .mockResolvedValue(makeMember('mem-new', 'user-new', BusinessRole.STAFF));

      const result = await service.addMember(
        'biz-1',
        { userId: 'user-new', role: BusinessRole.STAFF },
        'user-owner',
        UserRole.RECEPTIONIST,
      );

      expect(result.role).toBe(BusinessRole.STAFF);
      expect(prisma.businessMember.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { businessId: 'biz-1', userId: 'user-new', role: BusinessRole.STAFF },
        }),
      );
    });

    it('defaults role to STAFF when not provided', async () => {
      (prisma.businessMember.findUnique as jest.Mock)
        .mockResolvedValueOnce(ownerMembership);
      (prisma.businessMember.create as jest.Mock)
        .mockResolvedValue(makeMember('mem-new', 'user-new', BusinessRole.STAFF));

      await service.addMember('biz-1', { userId: 'user-new' }, 'user-owner', UserRole.RECEPTIONIST);

      expect(prisma.businessMember.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ role: BusinessRole.STAFF }) }),
      );
    });

    it('ADMIN can add a STAFF member', async () => {
      (prisma.businessMember.findUnique as jest.Mock)
        .mockResolvedValueOnce(adminMembership);
      (prisma.businessMember.create as jest.Mock)
        .mockResolvedValue(makeMember('mem-new', 'user-new', BusinessRole.STAFF));

      await expect(
        service.addMember('biz-1', { userId: 'user-new', role: BusinessRole.STAFF }, 'user-admin', UserRole.RECEPTIONIST),
      ).resolves.toBeDefined();
    });

    it('ADMIN cannot assign OWNER role', async () => {
      (prisma.businessMember.findUnique as jest.Mock)
        .mockResolvedValueOnce(adminMembership);

      await expect(
        service.addMember('biz-1', { userId: 'user-new', role: BusinessRole.OWNER as any }, 'user-admin', UserRole.RECEPTIONIST),
      ).rejects.toThrow(ForbiddenException);
    });

    it('STAFF cannot add members', async () => {
      (prisma.businessMember.findUnique as jest.Mock)
        .mockResolvedValueOnce(staffMembership);

      await expect(
        service.addMember('biz-1', { userId: 'user-new' }, 'user-staff', UserRole.RECEPTIONIST),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws ConflictException on duplicate membership', async () => {
      (prisma.businessMember.findUnique as jest.Mock)
        .mockResolvedValueOnce(ownerMembership);
      const prismaError = new Prisma.PrismaClientKnownRequestError('Unique constraint', {
        code: 'P2002',
        clientVersion: '0.0.0',
      });
      (prisma.businessMember.create as jest.Mock).mockRejectedValue(prismaError);

      await expect(
        service.addMember('biz-1', { userId: 'user-new' }, 'user-owner', UserRole.RECEPTIONIST),
      ).rejects.toThrow(ConflictException);
    });

    it('throws NotFoundException when target user does not exist', async () => {
      (prisma.businessMember.findUnique as jest.Mock)
        .mockResolvedValueOnce(ownerMembership);
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        service.addMember('biz-1', { userId: 'ghost' }, 'user-owner', UserRole.RECEPTIONIST),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when business does not exist', async () => {
      (prisma.business.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        service.addMember('biz-99', { userId: 'user-new' }, 'user-owner', UserRole.RECEPTIONIST),
      ).rejects.toThrow(NotFoundException);
    });

    it('system ADMIN bypasses membership check and can add members', async () => {
      (prisma.businessMember.create as jest.Mock)
        .mockResolvedValue(makeMember('mem-new', 'user-new', BusinessRole.STAFF));

      await expect(
        service.addMember('biz-1', { userId: 'user-new' }, 'sysadmin', UserRole.ADMIN),
      ).resolves.toBeDefined();

      // resolveActorRole should NOT query businessMember for system ADMIN
      expect(prisma.businessMember.findUnique).not.toHaveBeenCalled();
    });
  });

  // ── findMembers ─────────────────────────────────────────────────────────────

  describe('findMembers', () => {
    beforeEach(() => {
      (prisma.business.findUnique as jest.Mock).mockResolvedValue(mockBusiness);
    });

    it('returns paginated members for a valid member', async () => {
      (prisma.businessMember.findUnique as jest.Mock)
        .mockResolvedValueOnce(ownerMembership);
      (prisma.businessMember.findMany as jest.Mock)
        .mockResolvedValue([makeMember('mem-0', 'user-owner', BusinessRole.OWNER)]);
      (prisma.businessMember.count as jest.Mock).mockResolvedValue(1);

      const result = await service.findMembers('biz-1', {}, 'user-owner', UserRole.RECEPTIONIST);

      expect(result.meta.total).toBe(1);
      expect(result.data).toHaveLength(1);
    });

    it('throws ForbiddenException when requester is not a member', async () => {
      (prisma.businessMember.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        service.findMembers('biz-1', {}, 'outsider', UserRole.RECEPTIONIST),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // ── updateMemberRole ────────────────────────────────────────────────────────

  describe('updateMemberRole', () => {
    beforeEach(() => {
      (prisma.business.findUnique as jest.Mock).mockResolvedValue(mockBusiness);
    });

    it('OWNER can change a STAFF member to ADMIN', async () => {
      (prisma.businessMember.findUnique as jest.Mock)
        .mockResolvedValueOnce(ownerMembership);
      (prisma.businessMember.findFirst as jest.Mock)
        .mockResolvedValue(makeMember('mem-2', 'user-staff', BusinessRole.STAFF));
      (prisma.businessMember.update as jest.Mock)
        .mockResolvedValue(makeMember('mem-2', 'user-staff', BusinessRole.ADMIN));

      const result = await service.updateMemberRole(
        'biz-1', 'mem-2', { role: BusinessRole.ADMIN }, 'user-owner', UserRole.RECEPTIONIST,
      );

      expect(result.role).toBe(BusinessRole.ADMIN);
    });

    it('ADMIN cannot change roles', async () => {
      (prisma.businessMember.findUnique as jest.Mock)
        .mockResolvedValueOnce(adminMembership);

      await expect(
        service.updateMemberRole('biz-1', 'mem-2', { role: BusinessRole.STAFF }, 'user-admin', UserRole.RECEPTIONIST),
      ).rejects.toThrow(ForbiddenException);
    });

    it('cannot change the OWNER role', async () => {
      (prisma.businessMember.findUnique as jest.Mock)
        .mockResolvedValueOnce(ownerMembership);
      (prisma.businessMember.findFirst as jest.Mock)
        .mockResolvedValue(makeMember('mem-0', 'user-owner', BusinessRole.OWNER));

      await expect(
        service.updateMemberRole('biz-1', 'mem-0', { role: BusinessRole.ADMIN }, 'user-owner', UserRole.RECEPTIONIST),
      ).rejects.toThrow(ForbiddenException);
    });

    it('cannot change own role', async () => {
      (prisma.businessMember.findUnique as jest.Mock)
        .mockResolvedValueOnce(ownerMembership);
      // target member IS the actor
      (prisma.businessMember.findFirst as jest.Mock)
        .mockResolvedValue(makeMember('mem-0', 'user-owner', BusinessRole.STAFF));

      await expect(
        service.updateMemberRole('biz-1', 'mem-0', { role: BusinessRole.ADMIN }, 'user-owner', UserRole.RECEPTIONIST),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // ── removeMember ────────────────────────────────────────────────────────────

  describe('removeMember', () => {
    beforeEach(() => {
      (prisma.business.findUnique as jest.Mock).mockResolvedValue(mockBusiness);
    });

    it('OWNER can remove a STAFF member', async () => {
      (prisma.businessMember.findUnique as jest.Mock)
        .mockResolvedValueOnce(ownerMembership);
      (prisma.businessMember.findFirst as jest.Mock)
        .mockResolvedValue(makeMember('mem-2', 'user-staff', BusinessRole.STAFF));
      (prisma.businessMember.delete as jest.Mock)
        .mockResolvedValue(makeMember('mem-2', 'user-staff', BusinessRole.STAFF));

      const result = await service.removeMember('biz-1', 'mem-2', 'user-owner', UserRole.RECEPTIONIST);

      expect(result.id).toBe('mem-2');
    });

    it('ADMIN cannot remove the OWNER — rule 4', async () => {
      (prisma.businessMember.findUnique as jest.Mock)
        .mockResolvedValueOnce(adminMembership);
      (prisma.businessMember.findFirst as jest.Mock)
        .mockResolvedValue(makeMember('mem-0', 'user-owner', BusinessRole.OWNER));

      await expect(
        service.removeMember('biz-1', 'mem-0', 'user-admin', UserRole.RECEPTIONIST),
      ).rejects.toThrow(ForbiddenException);
    });

    it('STAFF cannot remove any member', async () => {
      (prisma.businessMember.findUnique as jest.Mock)
        .mockResolvedValueOnce(staffMembership);

      await expect(
        service.removeMember('biz-1', 'mem-2', 'user-staff', UserRole.RECEPTIONIST),
      ).rejects.toThrow(ForbiddenException);
    });

    it('OWNER cannot remove themselves', async () => {
      (prisma.businessMember.findUnique as jest.Mock)
        .mockResolvedValueOnce(ownerMembership);
      (prisma.businessMember.findFirst as jest.Mock)
        .mockResolvedValue(makeMember('mem-0', 'user-owner', BusinessRole.OWNER));

      await expect(
        service.removeMember('biz-1', 'mem-0', 'user-owner', UserRole.RECEPTIONIST),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws NotFoundException when member does not exist', async () => {
      (prisma.businessMember.findUnique as jest.Mock)
        .mockResolvedValueOnce(ownerMembership);
      (prisma.businessMember.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        service.removeMember('biz-1', 'mem-99', 'user-owner', UserRole.RECEPTIONIST),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
