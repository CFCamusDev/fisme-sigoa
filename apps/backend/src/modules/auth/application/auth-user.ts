import type { AuthUser } from '@sigoa/shared';
import type { User } from '../domain/entities/user.js';

export function toAuthUser(user: User): AuthUser {
  return {
    id: user.id,
    names: user.names,
    firstSurname: user.firstSurname,
    secondSurname: user.secondSurname ?? null,
    email: user.email,
  };
}
