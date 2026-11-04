/**
 * Módulo de Autorización (HU-006, HU-007, HU-008, cimientos para HU-003).
 * Provee servicios de cálculo de permisos efectivos, lectura de concesiones
 * y middleware requirePermission.
 */

export interface AuthorizationModuleServices {
  readonly isInitialized?: boolean;
}

export interface AuthorizationModuleDependencies {
  readonly placeholder?: never;
}

export function createAuthorizationServices(
  _deps: AuthorizationModuleDependencies,
): AuthorizationModuleServices {
  return {};
}
