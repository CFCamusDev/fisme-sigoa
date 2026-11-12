import type { RoleStatus } from '@sigoa/shared';
import { Role } from '../../domain/entities/role.js';

export interface PrismaRoleRow {
  id: string;
  code: string;
  name: string;
  description: string | null;
  status: RoleStatus;
  deactivatedAt: Date | null;
  isPredefined: boolean;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export function mapPrismaRoleRowToDomain(row: PrismaRoleRow): Role {
  return Role.restore({
    id: row.id,
    code: row.code,
    name: row.name,
    description: row.description,
    status: row.status,
    deactivatedAt: row.deactivatedAt,
    isPredefined: row.isPredefined,
    createdBy: row.createdBy,
    updatedBy: row.updatedBy,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
}
