import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import {
  BusinessRole,
  BusinessType,
  UserRole,
} from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { BusinessService } from './business.service';

const mockOwner = { id: 'user-1', name: 'Alice', email: 'alice@example.com' };

const mockBusiness = {
  id: 'biz-1',
  name: 'Sot Samban',
  type: BusinessType.GUESTHOUSE,
  ownerId: 'user-1',
  owner: mockOwner,
  _count: { members: 1 },
  createdAt: new Date('2026-06-12'),
  updatedAt: new Date('2026-06-12'),
};

describe('BusinessService', () => {
  let service: BusinessService;
  let prisma: jest.Mocked<PrismaService>;

  const mockTransaction = jest.fn();

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BusinessService,
        {
          provide: PrismaService,
          useValue: {
            business: {
              create: jest.fn(),
              findMany: jest.fn(),
              findUnique: jest.fn(),
              findFirst: jest.fn(),
              findUniqueOrThrow: jest.fn(),
              update: jest.fn(),
              delete: jest.fn(),
              count: jest.fn(),
            },
            businessMember: {
              create: jest.fn(),
            },
            $transaction: mockTransaction,
          },
        },
      ],
    }).compile();

    service = module.get<BusinessService>(BusinessService);
    prisma = module.get(PrismaService);
  });

  afterEach(() => jest.clearAllMocks());

  // ── create ──────────────────────────────────────────────────────────────────

  describe('create', () => {
    it('creates business and OWNER membership in a transaction', async () => {
      mockTransaction.mockImplementation(async (fn: Function) => fn({
        business: {
          create: jest.fn().mockResolvedValue({ id: 'biz-1' }),
          findUniqueOrThrow: jest.fn().mockResolvedValue(mockBusiness),
        },
        businessMember: {
          create: jest.fn().mockResolvedValue({}),
        },
      }));

      const result = await service.create(
        { name: 'Sot Samban', type: BusinessType.GUESTHOUSE },
        'user-1',
      );

      expect(result.name).toBe('Sot Samban');
      expect(result.type).toBe(BusinessType.GUESTHOUSE);
      expect(result.ownerId).toBe('user-1');
      expect(result.memberCount).toBe(1);
      expect(mockTransaction).toHaveBeenCalledTimes(1);
    });
  });

  // ── findAll ─────────────────────────────────────────────────────────────────

  describe('findAll', () => {
    it('returns paginated list filtered by membership for RECEPTIONIST', async () => {
      (prisma.business.findMany as jest.Mock).mockResolvedValue([mockBusiness]);
      (prisma.business.count as jest.Mock).mockResolvedValue(1);

      const result = await service.findAll({}, 'user-1', UserRole.RECEPTIONIST);

      expect(prisma.business.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            members: { some: { userId: 'user-1' } },
          }),
        }),
      );
      expect(result.meta.total).toBe(1);
      expect(result.data).toHaveLength(1);
    });

    it('returns all businesses without membership filter for ADMIN', async () => {
      (prisma.business.findMany as jest.Mock).mockResolvedValue([mockBusiness]);
      (prisma.business.count as jest.Mock).mockResolvedValue(1);

      await service.findAll({}, 'admin-1', UserRole.ADMIN);

      expect(prisma.business.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: {} }),
      );
    });

    it('applies name search filter', async () => {
      (prisma.business.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.business.count as jest.Mock).mockResolvedValue(0);

      await service.findAll({ search: 'samban' }, 'user-1', UserRole.RECEPTIONIST);

      expect(prisma.business.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            AND: [
              { members: { some: { userId: 'user-1' } } },
              { name: { contains: 'samban', mode: 'insensitive' } },
            ],
          },
        }),
      );
    });
  });

  // ── findOne ─────────────────────────────────────────────────────────────────

  describe('findOne', () => {
    it('returns the business when user is a member', async () => {
      (prisma.business.findFirst as jest.Mock).mockResolvedValue(mockBusiness);

      const result = await service.findOne('biz-1', 'user-1', UserRole.RECEPTIONIST);

      expect(result.id).toBe('biz-1');
      expect(prisma.business.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'biz-1', members: { some: { userId: 'user-1' } } },
        }),
      );
    });

    it('throws NotFoundException when business does not exist or user is not a member', async () => {
      (prisma.business.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        service.findOne('biz-99', 'user-1', UserRole.RECEPTIONIST),
      ).rejects.toThrow(NotFoundException);
    });

    it('ADMIN can access any business without membership filter', async () => {
      (prisma.business.findFirst as jest.Mock).mockResolvedValue(mockBusiness);

      await service.findOne('biz-1', 'admin-1', UserRole.ADMIN);

      expect(prisma.business.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'biz-1' } }),
      );
    });
  });

  // ── update ──────────────────────────────────────────────────────────────────

  describe('update', () => {
    it('updates business when called by the owner', async () => {
      (prisma.business.findUnique as jest.Mock).mockResolvedValue(mockBusiness);
      (prisma.business.update as jest.Mock).mockResolvedValue({
        ...mockBusiness,
        name: 'New Name',
      });

      const result = await service.update(
        'biz-1',
        { name: 'New Name' },
        'user-1',
      );

      expect(result.name).toBe('New Name');
    });

    it('throws ForbiddenException when called by a non-owner', async () => {
      (prisma.business.findUnique as jest.Mock).mockResolvedValue(mockBusiness);

      await expect(
        service.update('biz-1', { name: 'X' }, 'user-99'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws NotFoundException when business does not exist', async () => {
      (prisma.business.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        service.update('biz-99', { name: 'X' }, 'user-1'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ── remove ──────────────────────────────────────────────────────────────────

  describe('remove', () => {
    it('deletes business when called by the owner', async () => {
      (prisma.business.findUnique as jest.Mock).mockResolvedValue(mockBusiness);
      (prisma.business.delete as jest.Mock).mockResolvedValue(mockBusiness);

      const result = await service.remove('biz-1', 'user-1');

      expect(result.id).toBe('biz-1');
      expect(prisma.business.delete).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'biz-1' } }),
      );
    });

    it('throws ForbiddenException when called by a non-owner', async () => {
      (prisma.business.findUnique as jest.Mock).mockResolvedValue(mockBusiness);

      await expect(service.remove('biz-1', 'user-99')).rejects.toThrow(
        ForbiddenException,
      );
    });
  });
});
