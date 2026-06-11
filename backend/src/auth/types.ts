import { PreferredLanguage, UserRole } from '../../generated/prisma/client';
import { Request } from 'express';

export type AuthUser = {
  userId: string;
  email: string;
  role: UserRole;
  preferredLanguage?: PreferredLanguage;
};

export type RequestWithUser = Request & {
  user: AuthUser;
};
