import { IsEmail, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateGuestDto {
  @IsString()
  @IsNotEmpty()
  fullName: string;

  @IsString()
  @IsNotEmpty()
  phone: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  idCardNumber?: string;

  @IsString()
  @IsOptional()
  address?: string;
}
