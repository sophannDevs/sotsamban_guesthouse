import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync } from 'node:fs';
import { extname, join } from 'node:path';
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  MaxFileSizeValidator,
  Param,
  ParseFilePipe,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';

import { UserRole } from '../../generated/prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { apiResponse } from '../common/api-response';
import type { PaginationQuery } from '../common/pagination';
import { CreateRoomDto } from './dto/create-room.dto';
import { UpdateRoomDto } from './dto/update-room.dto';
import { RoomsService } from './rooms.service';

const maxRoomImageSize = 5 * 1024 * 1024;
const allowedRoomImageTypes = [
  'image/jpeg',
  'image/png',
  'image/webp',
] as readonly string[];
const roomUploadPath = join(process.cwd(), 'uploads', 'rooms');

const roomImageUploadOptions = {
  storage: diskStorage({
    destination: (_request, _file, callback) => {
      if (!existsSync(roomUploadPath)) {
        mkdirSync(roomUploadPath, { recursive: true });
      }

      callback(null, roomUploadPath);
    },
    filename: (_request, file, callback) => {
      const extension = extname(file.originalname).toLowerCase();
      const filename = `${Date.now()}-${randomUUID()}${extension}`;

      callback(null, filename);
    },
  }),
  limits: {
    fileSize: maxRoomImageSize,
  },
  fileFilter: (
    _request: unknown,
    file: Express.Multer.File,
    callback: (error: Error | null, acceptFile: boolean) => void,
  ) => {
    if (!allowedRoomImageTypes.includes(file.mimetype)) {
      callback(
        new BadRequestException(
          'Only jpg, jpeg, png, and webp images are allowed.',
        ),
        false,
      );
      return;
    }

    callback(null, true);
  },
};

@Controller('rooms')
export class RoomsController {
  constructor(private readonly roomsService: RoomsService) {}

  @Roles(UserRole.ADMIN)
  @Post()
  async create(@Body() createRoomDto: CreateRoomDto) {
    const room = await this.roomsService.create(createRoomDto);

    return apiResponse('Room created successfully.', room);
  }

  @Roles(UserRole.ADMIN)
  @Post(':id/image')
  @UseInterceptors(FileInterceptor('file', roomImageUploadOptions))
  async uploadImage(
    @Param('id') id: string,
    @UploadedFile(
      new ParseFilePipe({
        fileIsRequired: true,
        validators: [new MaxFileSizeValidator({ maxSize: maxRoomImageSize })],
      }),
    )
    file: Express.Multer.File,
  ) {
    const imageUrl = `/uploads/rooms/${file.filename}`;
    const room = await this.roomsService.updateImage(id, imageUrl);

    return apiResponse('Room image uploaded successfully.', {
      imageUrl: room.imageUrl,
    });
  }

  @Roles(UserRole.ADMIN, UserRole.RECEPTIONIST)
  @Get()
  async findAll(@Query() query: PaginationQuery) {
    const rooms = await this.roomsService.findAll(query);

    return rooms;
  }

  @Roles(UserRole.ADMIN, UserRole.RECEPTIONIST)
  @Get('availability')
  async getAvailability(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const availability = await this.roomsService.getAvailability({
      startDate,
      endDate,
    });

    return apiResponse(
      'Room availability retrieved successfully.',
      availability,
    );
  }

  @Roles(UserRole.ADMIN, UserRole.RECEPTIONIST)
  @Get(':id')
  async findOne(@Param('id') id: string) {
    const room = await this.roomsService.findOne(id);

    return apiResponse('Room retrieved successfully.', room);
  }

  @Roles(UserRole.ADMIN)
  @Patch(':id')
  async update(@Param('id') id: string, @Body() updateRoomDto: UpdateRoomDto) {
    const room = await this.roomsService.update(id, updateRoomDto);

    return apiResponse('Room updated successfully.', room);
  }

  @Roles(UserRole.ADMIN)
  @Delete(':id')
  async remove(@Param('id') id: string) {
    const room = await this.roomsService.remove(id);

    return apiResponse('Room deleted successfully.', room);
  }
}
