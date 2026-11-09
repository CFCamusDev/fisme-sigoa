export type PermissionScope = 'GLOBAL' | 'OWN';

export interface Grant {
  readonly permission: string;
  readonly scope: PermissionScope;
}

export type EffectivePermissions = Map<string, PermissionScope>;

export function widerScope(left: PermissionScope, right: PermissionScope): PermissionScope {
  return left === 'GLOBAL' || right === 'GLOBAL' ? 'GLOBAL' : 'OWN';
}

/**
 * Calcula el mapa de permisos efectivos a partir de una lista de concesiones.
 * Regla de precedencia (RS-011, RS-012):
 * Si un permiso tiene concesiones tanto con alcance GLOBAL como OWN,
 * prevalece el alcance más amplio (GLOBAL).
 */
export function computeEffectivePermissions(grants: readonly Grant[]): EffectivePermissions {
  const effective: EffectivePermissions = new Map();

  for (const grant of grants) {
    const existing = effective.get(grant.permission);
    effective.set(grant.permission, existing ? widerScope(existing, grant.scope) : grant.scope);
  }

  return effective;
}

/**
 * Evalúa si un permiso requerido con un alcance dado está concedido en los permisos efectivos.
 * Jerarquía:
 * - Un alcance requerido GLOBAL exige estrictamente una concesión GLOBAL.
 * - Un alcance requerido OWN se satisface con una concesión OWN o una concesión GLOBAL.
 */
export function isGranted(
  effective: EffectivePermissions,
  permission: string,
  requiredScope: PermissionScope,
): boolean {
  const grantedScope = effective.get(permission);
  if (!grantedScope) {
    return false;
  }

  if (requiredScope === 'GLOBAL') {
    return grantedScope === 'GLOBAL';
  }

  // requiredScope === 'OWN'
  return grantedScope === 'OWN' || grantedScope === 'GLOBAL';
}
