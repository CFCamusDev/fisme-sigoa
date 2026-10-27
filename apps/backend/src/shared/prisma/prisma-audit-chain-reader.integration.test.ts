import { describe, expect, it } from 'vitest';
import { useTestDatabase } from '../../test/db/use-test-database.js';
import { AuditChainVerifier } from '../audit/audit-chain-verifier.js';
import { PrismaAuditChainReader } from './prisma-audit-chain-reader.js';
import { PrismaAuditLogger } from './prisma-audit-logger.js';
import { PrismaUnitOfWork } from './prisma-unit-of-work.js';

describe('PrismaAuditChainReader Integration (PostgreSQL real, RS-042, RNF-015)', () => {
  const { getPrisma } = useTestDatabase();
  const prisma = getPrisma();
  const uow = new PrismaUnitOfWork(prisma);
  const logger = new PrismaAuditLogger(uow);
  const reader = new PrismaAuditChainReader(uow);
  const verifier = new AuditChainVerifier(reader);

  async function seedChainedLogs(count: number): Promise<void> {
    for (let i = 1; i <= count; i++) {
      await uow.run(async () => {
        await logger.log({
          action: 'CREATE',
          entity: 'EducationalObjective',
          entityId: `oe-${i}`,
          actor: `user-${i}`,
          after: { title: `Objetivo ${i}` },
        });
      });
    }
  }

  it('verifies an intact chain written by the audit logger across multiple batches', async () => {
    // Escribimos 4 registros para forzar el cruce de lotes con batchSize = 2
    await seedChainedLogs(4);

    const result = await verifier.verify(2);

    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.checked).toBe(4);
    }
  });

  it('reports the first altered record with HASH_MISMATCH when modified', async () => {
    await seedChainedLogs(4);

    // Modificamos el contenido del registro con sequence = 2
    await prisma.auditLog.update({
      where: { sequence: 2n },
      data: { actor: 'malicious-actor' },
    });

    const result = await verifier.verify(2);

    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.firstInvalid).toEqual({
        sequence: 2n,
        reason: 'HASH_MISMATCH',
      });
    }
  });

  it('reports a deleted record with SEQUENCE_GAP when a record is removed', async () => {
    await seedChainedLogs(4);

    // Eliminamos el registro con sequence = 2
    await prisma.auditLog.delete({
      where: { sequence: 2n },
    });

    const result = await verifier.verify(2);

    expect(result.valid).toBe(false);
    if (!result.valid) {
      // El siguiente registro es sequence 3, pero se esperaba sequence 2
      expect(result.firstInvalid).toEqual({
        sequence: 3n,
        reason: 'SEQUENCE_GAP',
      });
    }
  });
});
