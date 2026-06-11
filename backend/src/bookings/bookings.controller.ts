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

import { BookingStatus, UserRole } from '../../generated/prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import type { AuthUser } from '../auth/types';
import { apiResponse } from '../common/api-response';
import type { PaginationQuery } from '../common/pagination';
import { BookingsService } from './bookings.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { UpdateBookingDto } from './dto/update-booking.dto';

@Roles(UserRole.ADMIN, UserRole.RECEPTIONIST)
@Controller('bookings')
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Post()
  async create(
    @Body() createBookingDto: CreateBookingDto,
    @CurrentUser() currentUser: AuthUser,
  ) {
    const booking = await this.bookingsService.create(
      createBookingDto,
      currentUser.userId,
    );

    return apiResponse('Booking created successfully.', booking);
  }

  @Get()
  async findAll(@Query() query: PaginationQuery & { status?: BookingStatus }) {
    const bookings = await this.bookingsService.findAll(query);

    return bookings;
  }

  @Get('check-conflict')
  async checkConflict(
    @Query('roomId') roomId: string,
    @Query('checkInDate') checkInDate: string,
    @Query('checkOutDate') checkOutDate: string,
    @Query('excludeBookingId') excludeBookingId?: string,
  ) {
    const result = await this.bookingsService.checkConflict(
      roomId,
      checkInDate,
      checkOutDate,
      excludeBookingId,
    );

    return apiResponse('Conflict check completed.', result);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const booking = await this.bookingsService.findOne(id);

    return apiResponse('Booking retrieved successfully.', booking);
  }

  @Patch(':id/check-in')
  async checkIn(@Param('id') id: string, @CurrentUser() currentUser: AuthUser) {
    const booking = await this.bookingsService.checkIn(id, currentUser.userId);

    return apiResponse('Booking checked in successfully.', booking);
  }

  @Patch(':id/check-out')
  async checkOut(
    @Param('id') id: string,
    @CurrentUser() currentUser: AuthUser,
  ) {
    const booking = await this.bookingsService.checkOut(id, currentUser.userId);

    return apiResponse('Booking checked out successfully.', booking);
  }

  @Patch(':id/cancel')
  async cancel(@Param('id') id: string) {
    const booking = await this.bookingsService.cancel(id);

    return apiResponse('Booking cancelled successfully.', booking);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() updateBookingDto: UpdateBookingDto,
  ) {
    const booking = await this.bookingsService.update(id, updateBookingDto);

    return apiResponse('Booking updated successfully.', booking);
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    const booking = await this.bookingsService.remove(id);

    return apiResponse('Booking deleted successfully.', booking);
  }
}
