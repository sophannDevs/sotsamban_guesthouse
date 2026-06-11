import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';

import { translateError } from '../../common/i18n';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { AuthUser } from '../types';

type RequestWithOptionalUser = Request & {
  user?: AuthUser;
};

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context
      .switchToHttp()
      .getRequest<RequestWithOptionalUser>();
    const token = this.extractTokenFromHeader(request);

    if (!token) {
      throw new UnauthorizedException(translateError('missingAccessToken'));
    }

    try {
      request.user = await this.jwtService.verifyAsync<AuthUser>(token, {
        secret: this.getJwtSecret(),
      });
    } catch {
      throw new UnauthorizedException(translateError('invalidAccessToken'));
    }

    return true;
  }

  private extractTokenFromHeader(request: Request) {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];

    return type === 'Bearer' ? token : undefined;
  }

  private getJwtSecret() {
    return this.configService.get<string>('JWT_SECRET') ?? 'dev-jwt-secret';
  }
}
