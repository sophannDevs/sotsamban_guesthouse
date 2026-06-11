import { createParamDecorator, ExecutionContext } from '@nestjs/common';

import { AuthUser, RequestWithUser } from '../types';

export const CurrentUser = createParamDecorator(
  (data: keyof AuthUser | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<RequestWithUser>();

    return data ? request.user[data] : request.user;
  },
);
