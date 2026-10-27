import { describe, expect, it } from 'vitest';
import { useTestDatabase } from '../../test/db/use-test-database.js';
import { computeAuditHash } from '../audit/audit-hash.js';
import { runWithRequestContext } from '../audit/index.js';
import { PrismaAuditLogger } from './prisma-audit-logger.js';
import { PrismaUnitOfWork } from './prisma-unit-of-work.js';

describe('PrismaAuditLogger Integration (PostgreSQL real)', () => {
  const { getPrisma } = useTestDatabase();
  const prisma = getPrisma();
  const uow = new PrismaUnitOfWork(prisma);
  const logger = new PrismaAuditLogger(uow);

  it('appends chained records inside the unit of work', async () => {
    await uow.run(async () => {
      await logger.log({
        action: 'CREATE',
        entity: 'EducationalObjective',
        entityId: 'oe-cuid-1',
        actor: 'user-audit-1',
        ip: '192.168.1.10',
        after: { code: 'OE01', title: 'Objetivo Uno' },
      });

      await logger.log({
        action: 'UPDATE',
        entity: 'EducationalObjective',
        entityId: 'oe-cuid-1',
        actor: 'user-audit-1',
        ip: '192.168.1.10',
        before: { code: 'OE01', title: 'Objetivo Uno' },
        after: { code: 'OE01', title: 'Objetivo Uno Actualizado' },
      });

      await logger.log({
        action: 'STATE_CHANGE',
        entity: 'EducationalObjective',
        entityId: 'oe-cuid-1',
        actor: 'user-audit-2',
        ip: '192.168.1.20',
        before: { status: 'DRAFT' },
        after: { status: 'APPROVED' },
      });
    });

    const logs = await prisma.auditLog.findMany({
      orderBy: { sequence: 'asc' },
    });

    expect(logs.length).toBe(3);

    // Registro 1
    const log1 = logs[0]!;
    expect(log1.sequence).toBe(1n);
    expect(log1.previousHash).toBeNull();
    expect(log1.action).toBe('CREATE');
    expect(log1.actor).toBe('user-audit-1');
    expect(log1.hash).toBe(
      computeAuditHash({
        action: log1.action,
        actor: log1.actor,
        after: log1.after as Record<string, unknown>,
        before: log1.before as Record<string, unknown>,
        entity: log1.entity,
        entityId: log1.entityId,
        ip: log1.ip,
        occurredAt: log1.occurredAt,
        previousHash: log1.previousHash,
        requestId: log1.requestId,
        sequence: log1.sequence,
      }),
    );

    // Registro 2
    const log2 = logs[1]!;
    expect(log2.sequence).toBe(2n);
    expect(log2.previousHash).toBe(log1.hash);
    expect(log2.action).toBe('UPDATE');
    expect(log2.hash).toBe(
      computeAuditHash({
        action: log2.action,
        actor: log2.actor,
        after: log2.after as Record<string, unknown>,
        before: log2.before as Record<string, unknown>,
        entity: log2.entity,
        entityId: log2.entityId,
        ip: log2.ip,
        occurredAt: log2.occurredAt,
        previousHash: log2.previousHash,
        requestId: log2.requestId,
        sequence: log2.sequence,
      }),
    );

    // Registro 3
    const log3 = logs[2]!;
    expect(log3.sequence).toBe(3n);
    expect(log3.previousHash).toBe(log2.hash);
    expect(log3.action).toBe('STATE_CHANGE');
    expect(log3.hash).toBe(
      computeAuditHash({
        action: log3.action,
        actor: log3.actor,
        after: log3.after as Record<string, unknown>,
        before: log3.before as Record<string, unknown>,
        entity: log3.entity,
        entityId: log3.entityId,
        ip: log3.ip,
        occurredAt: log3.occurredAt,
        previousHash: log3.previousHash,
        requestId: log3.requestId,
        sequence: log3.sequence,
      }),
    );
  });

  it('serializes concurrent transactions without repeating sequences or breaking the hash chain', async () => {
    // Ejecuta 4 transacciones independientes de forma concurrente
    const tasks = Array.from({ length: 4 }).map((_, index) =>
      uow.run(async () => {
        await logger.log({
          action: 'CREATE',
          entity: 'GraduateAttribute',
          entityId: `ag-cuid-${index}`,
          actor: `concurrent-actor-${index}`,
          after: { index },
        });
      }),
    );

    await Promise.all(tasks);

    const logs = await prisma.auditLog.findMany({
      orderBy: { sequence: 'asc' },
    });

    // Verificamos que las secuencias sean estrictamente correlativas
    for (let i = 0; i < logs.length; i++) {
      const current = logs[i]!;
      expect(current.sequence).toBe(BigInt(i + 1));

      if (i === 0) {
        expect(current.previousHash).toBeNull();
      } else {
        const previous = logs[i - 1]!;
        expect(current.previousHash).toBe(previous.hash);
      }

      // Verificamos integridad del hash
      const expectedHash = computeAuditHash({
        action: current.action,
        actor: current.actor,
        after: current.after as Record<string, unknown>,
        before: current.before as Record<string, unknown>,
        entity: current.entity,
        entityId: current.entityId,
        ip: current.ip,
        occurredAt: current.occurredAt,
        previousHash: current.previousHash,
        requestId: current.requestId,
        sequence: current.sequence,
      });

      expect(current.hash).toBe(expectedHash);
    }
  });

  it('automatically resolves actor, ip and requestId from request context when omitted from event', async () => {
    const context = {
      actor: 'contextual-user-789',
      ip: '190.119.200.15',
      requestId: 'f6b21544-b29b-449d-a411-cf08d1f7c32e',
    };

    await runWithRequestContext(context, async () => {
      await uow.run(async () => {
        await logger.log({
          action: 'LOGIN_SUCCESS',
          entity: 'User',
          entityId: 'contextual-user-789',
          after: { loginAt: '2026-10-26T22:00:00Z' },
        });
      });
    });

    const savedLog = await prisma.auditLog.findFirst({
      where: { entityId: 'contextual-user-789' },
    });

    expect(savedLog).not.toBeNull();
    expect(savedLog?.actor).toBe(context.actor);
    expect(savedLog?.ip).toBe(context.ip);
    expect(savedLog?.requestId).toBe(context.requestId);
  });
});
