import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';

import { UserRole } from '../../generated/prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import type { AuthUser } from '../auth/types';
import { apiResponse } from '../common/api-response';
import type { PaginationQuery } from '../common/pagination';
import { BusinessMemberService } from './business-member.service';
import { AddMemberDto } from './dto/add-member.dto';
import { UpdateMemberRoleDto } from './dto/update-member-role.dto';

@Roles(UserRole.ADMIN, UserRole.RECEPTIONIST)
@Controller('businesses/:id/members')
export class BusinessMemberController {
  constructor(private readonly memberService: BusinessMemberService) {}

  @Post()
  async addMember(
    @Param('id') businessId: string,
    @Body() addMemberDto: AddMemberDto,
    @CurrentUser() currentUser: AuthUser,
  ) {
    const member = await this.memberService.addMember(
      businessId,
      addMemberDto,
      currentUser.userId,
      currentUser.role,
    );

    return apiResponse('Member added successfully.', member);
  }

  @Get()
  async findMembers(
    @Param('id') businessId: string,
    @Query() query: PaginationQuery,
    @CurrentUser() currentUser: AuthUser,
  ) {
    return this.memberService.findMembers(
      businessId,
      query,
      currentUser.userId,
      currentUser.role,
    );
  }

  @Patch(':memberId')
  async updateMemberRole(
    @Param('id') businessId: string,
    @Param('memberId') memberId: string,
    @Body() updateMemberRoleDto: UpdateMemberRoleDto,
    @CurrentUser() currentUser: AuthUser,
  ) {
    const member = await this.memberService.updateMemberRole(
      businessId,
      memberId,
      updateMemberRoleDto,
      currentUser.userId,
      currentUser.role,
    );

    return apiResponse('Member role updated successfully.', member);
  }

  @Delete(':memberId')
  async removeMember(
    @Param('id') businessId: string,
    @Param('memberId') memberId: string,
    @CurrentUser() currentUser: AuthUser,
  ) {
    const member = await this.memberService.removeMember(
      businessId,
      memberId,
      currentUser.userId,
      currentUser.role,
    );

    return apiResponse('Member removed successfully.', member);
  }
}
