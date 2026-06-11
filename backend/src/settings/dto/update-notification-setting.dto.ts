import { IsBoolean, IsOptional } from 'class-validator';

export class UpdateNotificationSettingDto {
  @IsOptional()
  @IsBoolean()
  bookingAlerts?: boolean;

  @IsOptional()
  @IsBoolean()
  paymentAlerts?: boolean;

  @IsOptional()
  @IsBoolean()
  maintenanceAlerts?: boolean;

  @IsOptional()
  @IsBoolean()
  systemAlerts?: boolean;
}
