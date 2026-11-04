import type { UserDto } from '@sigoa/shared';
import type { User } from '../domain/entities/user.js';

export function toUserDto(user: User, roleIds: string[]): UserDto {
  return {
    id: user.id,
    names: user.names,
    firstSurname: user.firstSurname,
    secondSurname: user.secondSurname,
    email: user.email,
    dni: user.dni ?? '',
    status: user.status,
    roleIds,
    lastLoginAt: user.lastLoginAt ? user.lastLoginAt.toISOString() : null,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}
