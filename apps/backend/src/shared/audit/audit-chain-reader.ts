import type { AuditAction } from './audit-action.js';
import type { AuditPayload } from './audit-logger.js';

/**
 * Registro de auditoría obtenido para el proceso de verificación de integridad (RS-042, RNF-015).
 */
export interface AuditChainRecord {
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
  hash: string;
}

/**
 * Puerto de lectura por lotes de la cadena de auditoría para verificación (RS-042).
 */
export interface AuditChainReader {
  /**
   * Lee un lote de registros ordenados ascendentemente por secuencia mayor a afterSequence.
   * Si afterSequence es null, lee desde el inicio (secuencia 1n).
   */
  readBatch(afterSequence: bigint | null, limit: number): Promise<AuditChainRecord[]>;
}
