import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { JwtSignOptions } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';

import {
  PreferredLanguage,
  Prisma,
  User,
  UserRole,
} from '../../generated/prisma/client';
import { translateError } from '../common/i18n';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { AuthUser } from './types';

@Injectable()
export class AuthService {
  private readonly saltRounds = 10;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async register(registerDto: RegisterDto) {
    const userCount = await this.prisma.user.count();
    const passwordHash = await bcrypt.hash(
      registerDto.password,
      this.saltRounds,
    );

    try {
      const user = await this.prisma.user.create({
        data: {
          name: registerDto.name,
          email: registerDto.email,
          password: passwordHash,
          role: userCount === 0 ? UserRole.ADMIN : UserRole.RECEPTIONIST,
          preferredLanguage: PreferredLanguage.EN,
        },
      });

      return this.serializeUser(user);
    } catch (error) {
      this.handlePrismaError(error);
    }
  }

  async login(loginDto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: loginDto.email },
    });

    if (!user) {
      throw new UnauthorizedException(translateError('invalidCredentials'));
    }

    const isPasswordValid = await bcrypt.compare(
      loginDto.password,
      user.password,
    );

    if (!isPasswordValid) {
      throw new UnauthorizedException(translateError('invalidCredentials'));
    }

    return {
      accessToken: await this.signAccessToken(user),
      user: this.serializeUser(user),
    };
  }

  async me(currentUser: AuthUser) {
    const user = await this.prisma.user.findUnique({
      where: { id: currentUser.userId },
    });

    if (!user) {
      throw new UnauthorizedException(translateError('userNoLongerExists'));
    }

    return this.serializeUser(user);
  }

  private async signAccessToken(user: User) {
    const payload: AuthUser = {
      userId: user.id,
      email: user.email,
      role: user.role,
      preferredLanguage: user.preferredLanguage,
    };

    return this.jwtService.signAsync(payload, {
      secret: this.getJwtSecret(),
      expiresIn: this.getJwtExpiresIn(),
    });
  }

  private getJwtSecret() {
    return this.configService.get<string>('JWT_SECRET') ?? 'dev-jwt-secret';
  }

  private getJwtExpiresIn(): JwtSignOptions['expiresIn'] {
    return (this.configService.get<string>('JWT_EXPIRES_IN') ??
      '1d') as JwtSignOptions['expiresIn'];
  }

  private serializeUser(user: User) {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      preferredLanguage: user.preferredLanguage,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  private handlePrismaError(error: unknown): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictException('Email already exists.');
    }

    throw error;
  }
}
