import type { DesiredGrant } from '../ports/grant-types.js';
import type { PermissionScope } from './effective-permissions.js';

export function diffGrants(
  current: readonly {
    readonly id: string;
    readonly permissionId: string;
    readonly scope: PermissionScope;
  }[],
  desired: readonly DesiredGrant[],
): {
  toRemove: string[];
  toAdd: DesiredGrant[];
  toUpdate: Array<{ id: string; scope: PermissionScope }>;
} {
  const wanted = new Map<string, DesiredGrant>();
  for (const grant of desired) {
    if (wanted.has(grant.permissionId))
      throw new Error('El conjunto deseado contiene permisos duplicados');
    wanted.set(grant.permissionId, grant);
  }
  const existing = new Map(current.map((grant) => [grant.permissionId, grant]));
  const toRemove = current
    .filter((grant) => !wanted.has(grant.permissionId))
    .map((grant) => grant.id);
  const toAdd: DesiredGrant[] = [];
  const toUpdate: Array<{ id: string; scope: PermissionScope }> = [];
  for (const grant of desired) {
    const previous = existing.get(grant.permissionId);
    if (!previous) toAdd.push({ permissionId: grant.permissionId, scope: grant.scope });
    else if (previous.scope !== grant.scope) toUpdate.push({ id: previous.id, scope: grant.scope });
  }
  return { toRemove, toAdd, toUpdate };
}
