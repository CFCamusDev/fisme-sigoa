import crypto from 'node:crypto';
import type { AuditAction } from './audit-action.js';
import type { AuditPayload } from './audit-logger.js';

/**
 * Serializa de forma determinista y canónica cualquier valor JSON.
 * Ordena las claves alfabéticamente en todos los niveles para garantizar
 * que el cálculo del hash SHA-256 sea idéntico independientemente del orden
 * en que PostgreSQL o JavaScript almacenen las propiedades de un objeto jsonb (RS-041, RS-042).
 */
export function canonicalizeJson(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalizeJson(item)).join(',')}]`;
  }

  const record = value as Record<string, unknown>;
  const sortedKeys = Object.keys(record).sort();
  const serializedEntries = sortedKeys.map(
    (key) => `${JSON.stringify(key)}:${canonicalizeJson(record[key])}`,
  );

  return `{${serializedEntries.join(',')}}`;
}

/**
 * Datos requeridos para calcular el hash SHA-256 de un registro de auditoría (RS-041, RS-042).
 */
export interface AuditHashPayload {
  sequence: bigint;
  occurredAt: Date;
  actor: string;
  ip?: string | null;
  requestId?: string | null;
  action: AuditAction;
  entity: string;
  entityId: string;
  before?: AuditPayload | null;
  after?: AuditPayload | null;
  previousHash?: string | null;
}

/**
 * Calcula el hash SHA-256 encadenado de un registro de auditoría (RS-042, RNF-015).
 * Formato: SHA-256(previousHash + canonical(contenido))
 */
export function computeAuditHash(payload: AuditHashPayload): string {
  const content = {
    action: payload.action,
    actor: payload.actor,
    after: payload.after ?? null,
    before: payload.before ?? null,
    entity: payload.entity,
    entityId: payload.entityId,
    ip: payload.ip ?? null,
    occurredAt: payload.occurredAt.toISOString(),
    requestId: payload.requestId ?? null,
    sequence: payload.sequence.toString(),
  };

  const serializedContent = canonicalizeJson(content);
  const dataToHash = `${payload.previousHash ?? ''}${serializedContent}`;

  return crypto.createHash('sha256').update(dataToHash, 'utf8').digest('hex');
}
