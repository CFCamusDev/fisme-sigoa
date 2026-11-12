import { computeAuditHash } from '../audit/audit-hash.js';
import type { AuditChainAnchor } from '../audit/audit-chain-anchor.js';
import type { AuditEvent, AuditLogger } from '../audit/audit-logger.js';
import { requestContextProvider, type RequestContextProvider } from '../audit/request-context.js';
import { ValidationError } from '../errors/app-error.js';
import type { Prisma } from './generated/client.js';
import type { DbProvider } from './prisma-unit-of-work.js';

export { type RequestAuditContext, type RequestContextProvider } from '../audit/request-context.js';

/**
 * Identificador constante para el bloqueo asesor de transacción de PostgreSQL (HU-075).
 * Serializa de forma determinista y segura las inserciones concurrentes de la cadena de auditoría.
 */
export const AUDIT_ADVISORY_LOCK_ID = 750750750;

/**
 * Adaptador de infraestructura Prisma para el puerto AuditLogger (RS-040, RS-041, RS-042, RNF-015, RNF-022).
 * Escribe registros de auditoría encadenados con SHA-256 en la transacción del caso de uso
 * y avanza opcionalmente el ancla de cabeza (RS-042).
 */
export class PrismaAuditLogger implements AuditLogger {
  constructor(
    private readonly dbProvider: DbProvider,
    private readonly contextProvider: RequestContextProvider = requestContextProvider,
    private readonly anchor?: AuditChainAnchor,
  ) {}

  async log(event: AuditEvent): Promise<void> {
    const client = this.dbProvider.get();
    const context = this.contextProvider.get();

    const actor = event.actor ?? context?.actor;
    if (!actor || actor.trim() === '') {
      throw new ValidationError(
        'Actor is required for audit log (RS-041). Provide it in the audit event or request context.',
      );
    }

    const ip = event.ip ?? context?.ip ?? null;
    const requestId = context?.requestId ?? null;

    // Serializa escrituras concurrentes con un bloqueo asesor a nivel de transacción
    if (typeof client.$executeRaw === 'function') {
      await client.$executeRaw`SELECT pg_advisory_xact_lock(${AUDIT_ADVISORY_LOCK_ID})`;
    }

    // Obtiene el último registro de auditoría para encadenar hash y secuencia
    const lastLog = await client.auditLog.findFirst({
      orderBy: { sequence: 'desc' },
      select: { sequence: true, hash: true },
    });

    const sequence = lastLog ? lastLog.sequence + 1n : 1n;
    const previousHash = lastLog ? lastLog.hash : null;
    const occurredAt = new Date();

    const hash = computeAuditHash({
      action: event.action,
      actor,
      after: event.after,
      before: event.before,
      entity: event.entity,
      entityId: event.entityId,
      ip,
      occurredAt,
      previousHash,
      requestId,
      sequence,
    });

    await client.auditLog.create({
      data: {
        action: event.action,
        actor,
        after: (event.after as Prisma.InputJsonValue) ?? undefined,
        before: (event.before as Prisma.InputJsonValue) ?? undefined,
        entity: event.entity,
        entityId: event.entityId,
        hash,
        ip,
        occurredAt,
        previousHash,
        requestId,
        sequence,
      },
    });

    if (this.anchor) {
      await this.anchor.advance({ sequence, hash });
    }
  }
}
