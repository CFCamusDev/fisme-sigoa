import type { UserStatus } from '@sigoa/shared';
import { User } from '../../domain/entities/user.js';

export interface PrismaUserRow {
  id: string;
  names: string;
  firstSurname: string;
  secondSurname: string | null;
  email: string;
  dni: string | null;
  status: UserStatus;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string | null;
  updatedBy: string | null;
}

export function mapPrismaUserRowToDomain(row: PrismaUserRow): User {
  return User.restore({
    id: row.id,
    names: row.names,
    firstSurname: row.firstSurname,
    secondSurname: row.secondSurname,
    email: row.email,
    dni: row.dni,
    status: row.status,
    lastLoginAt: row.lastLoginAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    createdBy: row.createdBy,
    updatedBy: row.updatedBy,
  });
}
