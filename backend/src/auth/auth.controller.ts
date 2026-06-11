import { Body, Controller, Get, Post } from '@nestjs/common';

import { apiResponse } from '../common/api-response';
import { AuthService } from './auth.service';
import { CurrentUser } from './decorators/current-user.decorator';
import { Public } from './decorators/public.decorator';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import type { AuthUser } from './types';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('register')
  async register(@Body() registerDto: RegisterDto) {
    const user = await this.authService.register(registerDto);

    return apiResponse('User registered successfully.', user);
  }

  @Public()
  @Post('login')
  async login(@Body() loginDto: LoginDto) {
    const auth = await this.authService.login(loginDto);

    return apiResponse('Login successful.', auth);
  }

  @Get('me')
  async me(@CurrentUser() currentUser: AuthUser) {
    const user = await this.authService.me(currentUser);

    return apiResponse('Current user retrieved successfully.', user);
  }
}
