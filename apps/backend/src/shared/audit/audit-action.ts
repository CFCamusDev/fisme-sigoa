/**
 * Acciones estándar de auditoría del sistema FISME-SIGOA (RS-043, RNF-016).
 * Define los tipos de eventos registrables por el puerto AuditLogger.
 */
export const AUDIT_ACTIONS = [
  'CREATE',
  'UPDATE',
  'STATE_CHANGE',
  'VOID',
  'LOGIN_SUCCESS',
  'LOGIN_FAILURE',
  'ROLE_CHANGE',
  'PERMISSION_CHANGE',
  'PARAMETER_CHANGE',
  'DOWNLOAD',
  'PUBLIC_RESPONSE',
  'ACCESS_DENIED',
] as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[number];
