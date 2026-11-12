import type { AuditChainAnchor, AuditChainHeadState } from '../audit/audit-chain-anchor.js';
import type { DbProvider } from './prisma-unit-of-work.js';

export const AUDIT_CHAIN_HEAD_ID = 'MAIN';

/**
 * Adaptador de infraestructura Prisma para persistir y leer la cabeza de la cadena de auditoría (RS-042, RNF-015).
 */
export class PrismaAuditChainAnchor implements AuditChainAnchor {
  constructor(private readonly dbProvider: DbProvider) {}

  async advance(head: AuditChainHeadState): Promise<void> {
    const client = this.dbProvider.get();

    await client.auditChainHead.upsert({
      where: {
        id: AUDIT_CHAIN_HEAD_ID,
      },
      create: {
        id: AUDIT_CHAIN_HEAD_ID,
        sequence: head.sequence,
        hash: head.hash,
      },
      update: {
        sequence: head.sequence,
        hash: head.hash,
      },
    });
  }

  async read(): Promise<AuditChainHeadState | null> {
    const client = this.dbProvider.get();

    const head = await client.auditChainHead.findUnique({
      where: {
        id: AUDIT_CHAIN_HEAD_ID,
      },
      select: {
        sequence: true,
        hash: true,
      },
    });

    if (!head) {
      return null;
    }

    return {
      sequence: head.sequence,
      hash: head.hash,
    };
  }
}
