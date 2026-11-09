import type { EffectivePermissions } from './effective-permissions.js';
import type { ResourceOwnershipStatus } from '../ports/resource-ownership-resolver.js';

export type ResourceOwnershipEvaluationInput = ResourceOwnershipStatus | 'UNKNOWN_RESOURCE_TYPE';

export type ResourceAccessDenialReason =
  'MISSING_PERMISSION' | 'NOT_OWNER' | 'UNKNOWN_RESOURCE_TYPE';

export type EvaluateResourceAccessResult =
  | { readonly allowed: true }
  | { readonly allowed: false; readonly reason: ResourceAccessDenialReason };

export interface EvaluateResourceAccessParams {
  readonly effective: EffectivePermissions;
  readonly permission: string;
  readonly ownership?: ResourceOwnershipEvaluationInput;
}

/**
 * Evalúa el acceso de un actor sobre un recurso específico según sus permisos efectivos (RS-011, RF-008).
 * - Sin concesión para el permiso → deniega con MISSING_PERMISSION.
 * - Concesión GLOBAL → permite sin requerir resolución de propietario.
 * - Concesión OWN → permite solo si ownership === 'OWNER'; si el tipo de recurso no está registrado
 *   deniega con UNKNOWN_RESOURCE_TYPE; en cualquier otro caso (NOT_OWNER, NOT_FOUND o sin resolver)
 *   deniega cerrado con NOT_OWNER para no permitir enumeración de recursos ajenos.
 */
export function evaluateResourceAccess(
  params: EvaluateResourceAccessParams,
): EvaluateResourceAccessResult {
  const grantedScope = params.effective.get(params.permission);
  if (!grantedScope) {
    return {
      allowed: false,
      reason: 'MISSING_PERMISSION',
    };
  }

  if (grantedScope === 'GLOBAL') {
    return {
      allowed: true,
    };
  }

  if (params.ownership === 'UNKNOWN_RESOURCE_TYPE') {
    return {
      allowed: false,
      reason: 'UNKNOWN_RESOURCE_TYPE',
    };
  }

  if (params.ownership === 'OWNER') {
    return {
      allowed: true,
    };
  }

  return {
    allowed: false,
    reason: 'NOT_OWNER',
  };
}
