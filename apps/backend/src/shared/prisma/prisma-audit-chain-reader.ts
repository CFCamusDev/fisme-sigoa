import type { AuditChainReader, AuditChainRecord } from '../audit/audit-chain-reader.js';
import type { AuditPayload } from '../audit/audit-logger.js';
import type { DbProvider } from './prisma-unit-of-work.js';

/**
 * Adaptador de infraestructura Prisma para leer la cadena de auditoría por lotes (RS-042, RNF-015).
 */
export class PrismaAuditChainReader implements AuditChainReader {
  constructor(private readonly dbProvider: DbProvider) {}

  async readBatch(afterSequence: bigint | null, limit: number): Promise<AuditChainRecord[]> {
    const client = this.dbProvider.get();

    const logs = await client.auditLog.findMany({
      where:
        afterSequence !== null
          ? {
              sequence: {
                gt: afterSequence,
              },
            }
          : undefined,
      orderBy: {
        sequence: 'asc',
      },
      take: limit,
    });

    return logs.map((log) => ({
      action: log.action,
      actor: log.actor,
      after: (log.after as AuditPayload) ?? null,
      before: (log.before as AuditPayload) ?? null,
      entity: log.entity,
      entityId: log.entityId,
      hash: log.hash,
      ip: log.ip,
      occurredAt: log.occurredAt,
      previousHash: log.previousHash,
      requestId: log.requestId,
      sequence: log.sequence,
    }));
  }
}
