import type { AuditChainReader, AuditChainRecord } from '../../shared/audit/audit-chain-reader.js';
import { computeAuditHash } from '../../shared/audit/audit-hash.js';

/**
 * Lector de cadena de auditoría en memoria para pruebas unitarias sin dependencias de base de datos.
 */
export class InMemoryAuditChainReader implements AuditChainReader {
  private records: AuditChainRecord[] = [];

  constructor(records: AuditChainRecord[] = []) {
    this.records = [...records];
  }

  setRecords(records: AuditChainRecord[]): void {
    this.records = [...records];
  }

  async readBatch(afterSequence: bigint | null, limit: number): Promise<AuditChainRecord[]> {
    const sorted = [...this.records].sort((a, b) => (a.sequence < b.sequence ? -1 : 1));

    const filtered =
      afterSequence !== null ? sorted.filter((record) => record.sequence > afterSequence) : sorted;

    return filtered.slice(0, limit);
  }
}

/**
 * Genera programáticamente una cadena válida de registros de auditoría correlativos y encadenados con SHA-256.
 */
export function createValidAuditChain(
  count: number,
  options: { baseTime?: Date; entityPrefix?: string } = {},
): AuditChainRecord[] {
  const records: AuditChainRecord[] = [];
  const baseTime = options.baseTime ?? new Date('2026-10-26T10:00:00.000Z');
  const entityPrefix = options.entityPrefix ?? 'EducationalObjective';

  let lastHash: string | null = null;

  for (let i = 1; i <= count; i++) {
    const sequence = BigInt(i);
    const occurredAt = new Date(baseTime.getTime() + i * 1000);
    const actor = `user-${i}`;
    const entity = entityPrefix;
    const entityId = `entity-id-${i}`;
    const action = i === 1 ? 'CREATE' : 'UPDATE';
    const before = i === 1 ? null : { version: i - 1 };
    const after = { version: i };
    const previousHash = lastHash;

    const hash = computeAuditHash({
      action,
      actor,
      after,
      before,
      entity,
      entityId,
      ip: '127.0.0.1',
      occurredAt,
      previousHash,
      requestId: `req-${i}`,
      sequence,
    });

    const record: AuditChainRecord = {
      action,
      actor,
      after,
      before,
      entity,
      entityId,
      hash,
      ip: '127.0.0.1',
      occurredAt,
      previousHash,
      requestId: `req-${i}`,
      sequence,
    };

    records.push(record);
    lastHash = hash;
  }

  return records;
}
