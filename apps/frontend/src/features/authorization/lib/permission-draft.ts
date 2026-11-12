import type {
  PermissionDto,
  PermissionScope,
  RoleDto,
  UpdateRolePermissionsRequest,
} from '@sigoa/shared';

export type DraftScope = 'NONE' | 'GLOBAL' | 'OWN';

export type PermissionDraft = Record<string, DraftScope>;

/**
 * Construye el estado inicial del borrador a partir del rol y el catálogo de permisos.
 * Los permisos que no estén concedidos al rol se inicializan con 'NONE'.
 * Concesiones en el rol cuyo código no exista en el catálogo se ignoran.
 */
export function buildDraft(
  role: Pick<RoleDto, 'permissions'>,
  catalog: readonly PermissionDto[],
): PermissionDraft {
  const catalogCodes = new Set(catalog.map((p) => p.code));
  const draft: PermissionDraft = {};

  for (const p of catalog) {
    draft[p.code] = 'NONE';
  }

  for (const grant of role.permissions) {
    if (catalogCodes.has(grant.permissionCode)) {
      draft[grant.permissionCode] = grant.scope;
    }
  }

  return draft;
}

/**
 * Actualiza de forma inmutable el alcance de un permiso en el borrador.
 */
export function setScope(
  draft: PermissionDraft,
  permissionCode: string,
  scope: DraftScope,
): PermissionDraft {
  return {
    ...draft,
    [permissionCode]: scope,
  };
}

/**
 * Cuenta la cantidad de permisos cuyo alcance difiere entre el borrador base y el actual.
 */
export function countChanges(base: PermissionDraft, current: PermissionDraft): number {
  let changes = 0;
  const allKeys = new Set([...Object.keys(base), ...Object.keys(current)]);

  for (const key of allKeys) {
    const baseScope = base[key] ?? 'NONE';
    const currentScope = current[key] ?? 'NONE';
    if (baseScope !== currentScope) {
      changes++;
    }
  }

  return changes;
}

/**
 * Transforma el borrador en un payload UpdateRolePermissionsRequest listo para enviar al backend.
 * Incluye únicamente los permisos con alcance distinto de 'NONE' y los ordena alfabéticamente por permissionCode.
 */
export function toUpdateRequest(draft: PermissionDraft): UpdateRolePermissionsRequest {
  const permissions: { permissionCode: string; scope: PermissionScope }[] = [];

  for (const [permissionCode, scope] of Object.entries(draft)) {
    if (scope === 'GLOBAL' || scope === 'OWN') {
      permissions.push({
        permissionCode,
        scope,
      });
    }
  }

  permissions.sort((a, b) => a.permissionCode.localeCompare(b.permissionCode));

  return { permissions };
}

/**
 * Agrupa los permisos del catálogo por módulo, preservando el orden de aparición.
 */
export function groupByModule(catalog: readonly PermissionDto[]): Record<string, PermissionDto[]> {
  const groups: Record<string, PermissionDto[]> = {};

  for (const permission of catalog) {
    const mod = permission.module;
    if (!groups[mod]) {
      groups[mod] = [];
    }
    groups[mod].push(permission);
  }

  return groups;
}
