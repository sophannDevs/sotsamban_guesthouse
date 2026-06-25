import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';

import {
  BookingSource,
  BookingStatus,
  BookingType,
  UserRole,
} from '../../generated/prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import type { AuthUser } from '../auth/types';
import { apiResponse } from '../common/api-response';
import type { PaginationQuery } from '../common/pagination';
import { BookingsService } from './bookings.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import {
  CreateHourlyBookingDto,
  PreviewHourlyBookingPriceDto,
} from './dto/create-hourly-booking.dto';
import { ExpressCheckInDto } from './dto/express-check-in.dto';
import { UpdateBookingDto } from './dto/update-booking.dto';
import { WalkInCheckInDto } from './dto/walk-in-check-in.dto';

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
  async findAll(
    @Query()
    query: PaginationQuery & {
      status?: BookingStatus;
      source?: BookingSource;
      bookingType?: BookingType;
    },
  ) {
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

  @Post('walk-in-check-in')
  async walkInCheckIn(
    @Body() dto: WalkInCheckInDto,
    @Headers('x-business-id') businessId: string,
    @CurrentUser() currentUser: AuthUser,
  ) {
    const booking = await this.bookingsService.walkInCheckIn(
      currentUser.userId,
      currentUser.role,
      businessId,
      dto,
    );

    return apiResponse('Walk-in check-in completed successfully.', booking);
  }

  @Post('express-check-in')
  async expressCheckIn(
    @Body() dto: ExpressCheckInDto,
    @Headers('x-business-id') businessId: string,
    @CurrentUser() currentUser: AuthUser,
  ) {
    const booking = await this.bookingsService.expressCheckIn(
      currentUser.userId,
      currentUser.role,
      businessId,
      dto,
    );

    return apiResponse('Express check-in completed successfully.', booking);
  }

  @Post('hourly/price-preview')
  async previewHourlyPrice(@Body() dto: PreviewHourlyBookingPriceDto) {
    const price = await this.bookingsService.previewHourlyPrice(dto);

    return apiResponse('Booking price calculated successfully.', price);
  }

  @Post('hourly')
  async createHourly(
    @Body() dto: CreateHourlyBookingDto,
    @Headers('x-business-id') businessId: string,
    @CurrentUser() currentUser: AuthUser,
  ) {
    const booking = await this.bookingsService.createHourly(
      currentUser.userId,
      currentUser.role,
      businessId,
      dto,
    );

    return apiResponse('Hourly booking created successfully.', booking);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const booking = await this.bookingsService.findOne(id);

    return apiResponse('Booking retrieved successfully.', booking);
  }

  @Post(':id/check-in')
  async checkIn(
    @Param('id') id: string,
    @Headers('x-business-id') businessId: string,
    @CurrentUser() currentUser: AuthUser,
  ) {
    const booking = await this.bookingsService.checkIn(
      id,
      businessId,
      currentUser.userId,
      currentUser.role,
    );

    return apiResponse('Booking checked in successfully.', booking);
  }

  @Post(':id/check-out')
  async checkOut(
    @Param('id') id: string,
    @Headers('x-business-id') businessId: string,
    @CurrentUser() currentUser: AuthUser,
  ) {
    const booking = await this.bookingsService.checkOut(
      id,
      businessId,
      currentUser.userId,
      currentUser.role,
    );

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
