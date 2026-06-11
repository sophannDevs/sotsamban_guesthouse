import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Query,
} from '@nestjs/common';

import { UserRole } from '../../generated/prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import type { AuthUser } from '../auth/types';
import { apiResponse } from '../common/api-response';
import type { PaginationQuery } from '../common/pagination';
import { UpdatePreferencesDto } from './dto/update-preferences.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UsersService } from './users.service';

@Roles(UserRole.ADMIN)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  async findAll(@Query() query: PaginationQuery) {
    const users = await this.usersService.findAll(query);

    return users;
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const user = await this.usersService.findOne(id);

    return apiResponse('User retrieved successfully.', user);
  }

  @Roles(UserRole.ADMIN, UserRole.RECEPTIONIST)
  @Patch('me/preferences')
  async updatePreferences(
    @CurrentUser() currentUser: AuthUser,
    @Body() updatePreferencesDto: UpdatePreferencesDto,
  ) {
    const user = await this.usersService.updatePreferences(
      currentUser.userId,
      updatePreferencesDto,
    );

    return apiResponse('User preferences updated successfully.', user);
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() updateUserDto: UpdateUserDto) {
    const user = await this.usersService.update(id, updateUserDto);

    return apiResponse('User updated successfully.', user);
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    const user = await this.usersService.remove(id);

    return apiResponse('User deleted successfully.', user);
  }
}
