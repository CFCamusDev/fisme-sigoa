import type { UpdateRolePermissionsRequest } from '@sigoa/shared';
import type { RoleRepository } from '../domain/ports/role-repository.js';
import type { PermissionRepository } from '../domain/ports/permission-repository.js';
import type { RolePermissionRepository } from '../domain/ports/role-permission-repository.js';
import type { RoleReader } from '../domain/ports/role-reader.js';
import type { PermissionCacheInvalidator } from '../domain/ports/permission-cache-invalidator.js';
import type { PermissionAuthorizer } from './permission-authorizer.js';
import type { UnitOfWork } from '../../../shared/unit-of-work/unit-of-work.js';
import type { AuditLogger } from '../../../shared/audit/audit-logger.js';

export interface EditRolePermissionsCommand {
  readonly actorId: string;
  readonly ip?: string;
  readonly roleId: string;
  readonly input: UpdateRolePermissionsRequest;
}

export interface EditRolePermissionsDependencies {
  readonly roleRepository: RoleRepository;
  readonly permissionRepository: PermissionRepository;
  readonly rolePermissionRepository: RolePermissionRepository;
  readonly roleReader: RoleReader;
  readonly authorizer: PermissionAuthorizer;
  readonly unitOfWork: UnitOfWork;
  readonly auditLogger: AuditLogger;
  readonly permissionCache: PermissionCacheInvalidator;
}
