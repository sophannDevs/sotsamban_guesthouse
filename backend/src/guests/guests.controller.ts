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
import { Roles } from '../auth/decorators/roles.decorator';
import { apiResponse } from '../common/api-response';
import type { PaginationQuery } from '../common/pagination';
import { CreateGuestDto } from './dto/create-guest.dto';
import { UpdateGuestDto } from './dto/update-guest.dto';
import { GuestsService } from './guests.service';

@Roles(UserRole.ADMIN, UserRole.RECEPTIONIST)
@Controller('guests')
export class GuestsController {
  constructor(private readonly guestsService: GuestsService) {}

  @Post()
  async create(@Body() createGuestDto: CreateGuestDto) {
    const guest = await this.guestsService.create(createGuestDto);

    return apiResponse('Guest created successfully.', guest);
  }

  @Get()
  async findAll(@Query() query: PaginationQuery) {
    const guests = await this.guestsService.findAll(query);

    return guests;
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const guest = await this.guestsService.findOne(id);

    return apiResponse('Guest retrieved successfully.', guest);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() updateGuestDto: UpdateGuestDto,
  ) {
    const guest = await this.guestsService.update(id, updateGuestDto);

    return apiResponse('Guest updated successfully.', guest);
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    const guest = await this.guestsService.remove(id);

    return apiResponse('Guest deleted successfully.', guest);
  }
}
