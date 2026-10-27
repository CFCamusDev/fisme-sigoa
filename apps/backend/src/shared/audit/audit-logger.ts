import type { AuditAction } from './audit-action.js';

/**
 * Payload JSON serializable para los estados antes y después de la entidad (RS-041).
 * Debe ser serializable a JSON estándar para garantizar integridad del hash SHA-256.
 */
export type AuditPayload = Record<string, unknown> | unknown[] | string | number | boolean | null;

/**
 * Evento de auditoría emitido por un caso de uso o servicio de aplicación (RS-041, RS-043).
 */
export interface AuditEvent {
  /** Acción ejecutada */
  action: AuditAction;
  /** Nombre del recurso o entidad auditada (ej. 'EducationalObjective', 'User') */
  entity: string;
  /** Identificador único de la entidad */
  entityId: string;
  /** Estado previo a la operación (opcional en altas) */
  before?: AuditPayload | null;
  /** Estado posterior a la operación (opcional en bajas o eliminaciones) */
  after?: AuditPayload | null;
  /** Actor explícito (opcional, se toma del contexto de la petición si no se provee) */
  actor?: string;
  /** Dirección IP explícita (opcional, se toma del contexto de la petición si no se provee) */
  ip?: string;
}

/**
 * Puerto de auditoría transversal inyectable en casos de uso de la aplicación (RS-043, RNF-016, RNF-026).
 */
export interface AuditLogger {
  log(event: AuditEvent): Promise<void>;
}
