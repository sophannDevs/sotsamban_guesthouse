import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';

import { PrismaService } from '../prisma/prisma.service';
import {
  createPaginatedResult,
  getPaginationOptions,
  PaginationQuery,
} from '../common/pagination';
import { ChangePasswordDto } from './dto/change-password.dto';
import { UpdateNotificationSettingDto } from './dto/update-notification-setting.dto';
import { UpdateProfileSettingDto } from './dto/update-profile-setting.dto';
import { UpdateSettingDto } from './dto/update-setting.dto';

const settingDefinitions = {
  guesthouseName: {
    value: 'Sot Samban GuestHouse',
    type: 'STRING',
  },
  guesthouseAddress: {
    value: '',
    type: 'STRING',
  },
  guesthousePhone: {
    value: '',
    type: 'STRING',
  },
  guesthouseEmail: {
    value: '',
    type: 'STRING',
  },
  currency: {
    value: 'USD',
    type: 'STRING',
  },
  timezone: {
    value: 'Asia/Phnom_Penh',
    type: 'STRING',
  },
  dateFormat: {
    value: 'YYYY-MM-DD',
    type: 'STRING',
  },
  language: {
    value: 'en',
    type: 'STRING',
  },
  logoUrl: {
    value: '',
    type: 'STRING',
  },
  airConditionerPricePerNight: {
    value: '5',
    type: 'NUMBER',
  },
} satisfies Record<string, { value: string; type: string }>;

export type SettingKey = keyof typeof settingDefinitions;

const settingSortFields = ['createdAt', 'updatedAt', 'key', 'type'] as const;

@Injectable()
export class SettingsService {
  private readonly saltRounds = 10;

  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: PaginationQuery) {
    await this.ensureDefaultSettings();
    const pagination = getPaginationOptions(query, {
      allowedSortBy: settingSortFields,
      defaultSortBy: 'key',
    });
    const where = pagination.search
      ? {
          OR: [
            {
              key: {
                contains: pagination.search,
                mode: 'insensitive' as const,
              },
            },
            {
              value: {
                contains: pagination.search,
                mode: 'insensitive' as const,
              },
            },
          ],
        }
      : {};
    const [settings, total] = await Promise.all([
      this.prisma.systemSetting.findMany({
        where,
        orderBy: {
          [pagination.sortBy]: pagination.sortOrder,
        },
        skip: pagination.skip,
        take: pagination.limit,
      }),
      this.prisma.systemSetting.count({ where }),
    ]);

    return createPaginatedResult(settings, total, pagination);
  }

  async findOne(key: string) {
    const settingKey = this.validateSettingKey(key);

    return this.upsertDefaultSetting(settingKey);
  }

  async update(key: string, updateSettingDto: UpdateSettingDto) {
    const settingKey = this.validateSettingKey(key);
    const definition = settingDefinitions[settingKey];
    const value = this.validateSettingValue(settingKey, updateSettingDto.value);

    return this.prisma.systemSetting.upsert({
      where: {
        key: settingKey,
      },
      create: {
        key: settingKey,
        value,
        type: definition.type,
      },
      update: {
        value,
        type: definition.type,
      },
    });
  }

  async getProfile(userId: string) {
    return this.prisma.user.findUniqueOrThrow({
      where: {
        id: userId,
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        preferredLanguage: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async updateProfile(
    userId: string,
    updateProfileSettingDto: UpdateProfileSettingDto,
  ) {
    return this.prisma.user.update({
      where: {
        id: userId,
      },
      data: {
        name: updateProfileSettingDto.name?.trim(),
        phone:
          updateProfileSettingDto.phone === undefined
            ? undefined
            : updateProfileSettingDto.phone.trim(),
        preferredLanguage: updateProfileSettingDto.preferredLanguage,
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        preferredLanguage: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  getNotificationSettings(userId: string) {
    return this.upsertDefaultNotificationSettings(userId);
  }

  async updateNotificationSettings(
    userId: string,
    updateNotificationSettingDto: UpdateNotificationSettingDto,
  ) {
    await this.upsertDefaultNotificationSettings(userId);

    return this.prisma.userNotificationSetting.update({
      where: {
        userId,
      },
      data: updateNotificationSettingDto,
    });
  }

  async changePassword(userId: string, changePasswordDto: ChangePasswordDto) {
    if (changePasswordDto.newPassword !== changePasswordDto.confirmPassword) {
      throw new BadRequestException(
        'New password and confirm password must match.',
      );
    }

    const user = await this.prisma.user.findUniqueOrThrow({
      where: {
        id: userId,
      },
    });
    const isCurrentPasswordValid = await bcrypt.compare(
      changePasswordDto.currentPassword,
      user.password,
    );

    if (!isCurrentPasswordValid) {
      throw new UnauthorizedException('Current password is incorrect.');
    }

    const passwordHash = await bcrypt.hash(
      changePasswordDto.newPassword,
      this.saltRounds,
    );

    await this.prisma.user.update({
      where: {
        id: userId,
      },
      data: {
        password: passwordHash,
      },
    });

    return {
      message: 'Password changed successfully.',
    };
  }

  private async ensureDefaultSettings() {
    await Promise.all(
      this.getSettingKeys().map((key) => this.upsertDefaultSetting(key)),
    );
  }

  private upsertDefaultSetting(key: SettingKey) {
    const definition = settingDefinitions[key];

    return this.prisma.systemSetting.upsert({
      where: {
        key,
      },
      create: {
        key,
        value: definition.value,
        type: definition.type,
      },
      update: {},
    });
  }

  private upsertDefaultNotificationSettings(userId: string) {
    return this.prisma.userNotificationSetting.upsert({
      where: {
        userId,
      },
      create: {
        userId,
      },
      update: {},
    });
  }

  private validateSettingKey(key: string): SettingKey {
    if (!this.isSettingKey(key)) {
      throw new BadRequestException(
        `Setting key must be one of: ${this.getSettingKeys().join(', ')}.`,
      );
    }

    return key;
  }

  private validateSettingValue(key: SettingKey, value: string) {
    const trimmedValue = value.trim();
    const allowedValues: Partial<Record<SettingKey, string[]>> = {
      currency: ['USD', 'KHR'],
      dateFormat: ['DD/MM/YYYY', 'YYYY-MM-DD', 'yyyy-MM-dd'],
      language: ['en', 'km'],
      timezone: ['Asia/Phnom_Penh'],
    };
    const allowed = allowedValues[key];

    if (allowed && !allowed.includes(trimmedValue)) {
      throw new BadRequestException(`Invalid value for setting key: ${key}.`);
    }

    if (key === 'dateFormat' && trimmedValue === 'yyyy-MM-dd') {
      return 'YYYY-MM-DD';
    }

    if (key === 'airConditionerPricePerNight') {
      const parsed = parseFloat(trimmedValue);
      if (isNaN(parsed) || parsed < 0) {
        throw new BadRequestException(
          `Setting '${key}' must be a non-negative number.`,
        );
      }
      return String(parsed);
    }

    return trimmedValue;
  }

  private isSettingKey(key: string): key is SettingKey {
    return key in settingDefinitions;
  }

  private getSettingKeys() {
    return Object.keys(settingDefinitions) as SettingKey[];
  }
}
