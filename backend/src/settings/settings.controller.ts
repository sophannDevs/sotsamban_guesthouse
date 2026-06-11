import { Body, Controller, Get, Param, Patch, Query } from '@nestjs/common';

import { UserRole } from '../../generated/prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import type { AuthUser } from '../auth/types';
import { apiResponse } from '../common/api-response';
import type { PaginationQuery } from '../common/pagination';
import { ChangePasswordDto } from './dto/change-password.dto';
import { UpdateNotificationSettingDto } from './dto/update-notification-setting.dto';
import { UpdateProfileSettingDto } from './dto/update-profile-setting.dto';
import { UpdateSettingDto } from './dto/update-setting.dto';
import { SettingsService } from './settings.service';

@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Roles(UserRole.ADMIN, UserRole.RECEPTIONIST)
  @Get('profile')
  async getProfile(@CurrentUser() currentUser: AuthUser) {
    const profile = await this.settingsService.getProfile(currentUser.userId);

    return apiResponse('Profile settings retrieved successfully.', profile);
  }

  @Roles(UserRole.ADMIN, UserRole.RECEPTIONIST)
  @Patch('profile')
  async updateProfile(
    @CurrentUser() currentUser: AuthUser,
    @Body() updateProfileSettingDto: UpdateProfileSettingDto,
  ) {
    const profile = await this.settingsService.updateProfile(
      currentUser.userId,
      updateProfileSettingDto,
    );

    return apiResponse('Profile settings updated successfully.', profile);
  }

  @Roles(UserRole.ADMIN, UserRole.RECEPTIONIST)
  @Get('notifications')
  async getNotificationSettings(@CurrentUser() currentUser: AuthUser) {
    const settings = await this.settingsService.getNotificationSettings(
      currentUser.userId,
    );

    return apiResponse(
      'Notification settings retrieved successfully.',
      settings,
    );
  }

  @Roles(UserRole.ADMIN, UserRole.RECEPTIONIST)
  @Patch('notifications')
  async updateNotificationSettings(
    @CurrentUser() currentUser: AuthUser,
    @Body() updateNotificationSettingDto: UpdateNotificationSettingDto,
  ) {
    const settings = await this.settingsService.updateNotificationSettings(
      currentUser.userId,
      updateNotificationSettingDto,
    );

    return apiResponse('Notification settings updated successfully.', settings);
  }

  @Roles(UserRole.ADMIN, UserRole.RECEPTIONIST)
  @Patch('security/change-password')
  async changePassword(
    @CurrentUser() currentUser: AuthUser,
    @Body() changePasswordDto: ChangePasswordDto,
  ) {
    const result = await this.settingsService.changePassword(
      currentUser.userId,
      changePasswordDto,
    );

    return apiResponse(result.message, null);
  }

  @Roles(UserRole.ADMIN, UserRole.RECEPTIONIST)
  @Get()
  async findAll(@Query() query: PaginationQuery) {
    const settings = await this.settingsService.findAll(query);

    return settings;
  }

  @Roles(UserRole.ADMIN, UserRole.RECEPTIONIST)
  @Get(':key')
  async findOne(@Param('key') key: string) {
    const setting = await this.settingsService.findOne(key);

    return apiResponse('Setting retrieved successfully.', setting);
  }

  @Roles(UserRole.ADMIN)
  @Patch(':key')
  async update(
    @Param('key') key: string,
    @Body() updateSettingDto: UpdateSettingDto,
  ) {
    const setting = await this.settingsService.update(key, updateSettingDto);

    return apiResponse('Setting updated successfully.', setting);
  }
}
