import { Module } from '@nestjs/common';

import { NotificationsModule } from '../notifications/notifications.module';
import { SettingsModule } from '../settings/settings.module';
import { BookingsController } from './bookings.controller';
import { BookingsService } from './bookings.service';

@Module({
  imports: [NotificationsModule, SettingsModule],
  controllers: [BookingsController],
  providers: [BookingsService],
})
export class BookingsModule {}
