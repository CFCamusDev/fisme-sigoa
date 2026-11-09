import { widerScope, type Grant, type PermissionScope } from './effective-permissions.js';

export interface RoleGrantSource {
  readonly roleId: string;
  readonly roleCode: string;
  readonly roleName: string;
  readonly grants: readonly Grant[];
}

export type AccessSource =
  | {
      readonly kind: 'ROLE';
      readonly roleId: string;
      readonly roleCode: string;
      readonly roleName: string;
      readonly scope: PermissionScope;
    }
  | { readonly kind: 'DIRECT'; readonly scope: PermissionScope };

export interface EffectiveAccessEntry extends Grant {
  readonly sources: readonly AccessSource[];
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function compareSources(left: AccessSource, right: AccessSource): number {
  if (left.kind === 'DIRECT') return right.kind === 'DIRECT' ? 0 : 1;
  if (right.kind === 'DIRECT') return -1;
  return compareText(left.roleCode, right.roleCode) || compareText(left.roleId, right.roleId);
}

/** El lector entrega únicamente roles activos; la unión conserva su procedencia (RS-012). */
export function computeEffectiveAccess(
  roles: readonly RoleGrantSource[],
  direct: readonly Grant[],
): EffectiveAccessEntry[] {
  const entries = new Map<string, { scope: PermissionScope; sources: Map<string, AccessSource> }>();

  function add(grant: Grant, source: AccessSource): void {
    let entry = entries.get(grant.permission);
    if (!entry) {
      entry = { scope: grant.scope, sources: new Map() };
      entries.set(grant.permission, entry);
    } else {
      entry.scope = widerScope(entry.scope, grant.scope);
    }
    const key = source.kind === 'ROLE' ? `ROLE:${source.roleId}` : 'DIRECT';
    const existing = entry.sources.get(key);
    entry.sources.set(key, {
      ...source,
      scope: existing ? widerScope(existing.scope, source.scope) : source.scope,
    });
  }

  for (const role of roles) {
    for (const grant of role.grants) {
      add(grant, {
        kind: 'ROLE',
        roleId: role.roleId,
        roleCode: role.roleCode,
        roleName: role.roleName,
        scope: grant.scope,
      });
    }
  }
  for (const grant of direct) add(grant, { kind: 'DIRECT', scope: grant.scope });

  return [...entries]
    .sort(([left], [right]) => compareText(left, right))
    .map(([permission, entry]) => ({
      permission,
      scope: entry.scope,
      sources: [...entry.sources.values()].sort(compareSources),
    }));
}
