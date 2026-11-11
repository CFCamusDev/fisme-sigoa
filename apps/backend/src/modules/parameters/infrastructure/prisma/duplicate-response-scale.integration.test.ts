import { describe, expect, it } from 'vitest';
import { AuditChainVerifier } from '../../../../shared/audit/audit-chain-verifier.js';
import type { AuditLogger } from '../../../../shared/audit/audit-logger.js';
import { PrismaAuditChainReader } from '../../../../shared/prisma/prisma-audit-chain-reader.js';
import { PrismaAuditLogger } from '../../../../shared/prisma/prisma-audit-logger.js';
import { PrismaUnitOfWork } from '../../../../shared/prisma/prisma-unit-of-work.js';
import { useTestDatabase } from '../../../../test/db/use-test-database.js';
import { DuplicateResponseScaleUseCase } from '../../application/duplicate-response-scale.js';
import {
  ResponseScaleCodeAlreadyExistsError,
  ResponseScaleNotFoundError,
} from '../../domain/errors/index.js';
import type { ParametersPermissionChecker } from '../../domain/ports/parameters-permission-checker.js';
import { PrismaResponseScaleRepository } from './prisma-response-scale-repository.js';
import { PrismaScaleLevelRepository } from './prisma-scale-level-repository.js';

describe('DuplicateResponseScaleUseCase Integration (PostgreSQL real, T-012-08, CA3)', () => {
  const { getPrisma } = useTestDatabase();
  const prisma = getPrisma();
  const uow = new PrismaUnitOfWork(prisma);
  const scaleRepository = new PrismaResponseScaleRepository(uow);
  const levelRepository = new PrismaScaleLevelRepository(uow);
  const permissionChecker: ParametersPermissionChecker = { assertAllowed: async () => {} };

  function build(auditLogger: AuditLogger = new PrismaAuditLogger(uow)) {
    return new DuplicateResponseScaleUseCase({
      scaleReader: scaleRepository,
      scaleRepository,
      levelRepository,
      permissionChecker,
      unitOfWork: uow,
      auditLogger,
    });
  }

  async function seedSource() {
    await prisma.responseScale.create({
      data: {
        id: 'source_1',
        code: 'EVIDENCE_4',
        name: 'Evidencia 4',
        type: 'EVIDENCE',
        levels: {
          create: [
            { order: 1, label: 'No se evidencia', value: 1, countsAsAchievement: false },
            { order: 2, label: 'Se evidencia mayormente', value: 3, countsAsAchievement: true },
            { order: 3, label: 'Se evidencia totalmente', value: 4, countsAsAchievement: true },
          ],
        },
      },
    });
  }

  async function expectValidAuditChain(): Promise<void> {
    const verifier = new AuditChainVerifier(new PrismaAuditChainReader(uow));
    expect((await verifier.verify()).valid).toBe(true);
  }

  it('copies the type and the levels into a new scale and audits duplicatedFrom', async () => {
    await seedSource();

    const dto = await build().execute({
      actorId: 'admin_1',
      sourceId: 'source_1',
      code: 'EVIDENCE_4_V2',
      name: 'Evidencia 4 (v2)',
    });

    expect(dto).toMatchObject({ code: 'EVIDENCE_4_V2', type: 'EVIDENCE', inUse: false });
    expect(dto.id).not.toBe('source_1');
    const levels = await prisma.scaleLevel.findMany({
      where: { scaleId: dto.id },
      orderBy: { order: 'asc' },
    });
    expect(levels.map((l) => [l.order, l.label, l.value, l.countsAsAchievement])).toEqual([
      [1, 'No se evidencia', 1, false],
      [2, 'Se evidencia mayormente', 3, true],
      [3, 'Se evidencia totalmente', 4, true],
    ]);
    expect(await prisma.scaleLevel.count({ where: { scaleId: 'source_1' } })).toBe(3);
    const events = await prisma.auditLog.findMany({ where: { entity: 'ResponseScale' } });
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ action: 'CREATE', entityId: dto.id });
    expect(events[0]?.after).toMatchObject({ duplicatedFrom: 'EVIDENCE_4' });
    await expectValidAuditChain();
  }, 15_000);

  it('answers not found for an unknown source and conflict for a repeated code', async () => {
    await seedSource();

    await expect(
      build().execute({ actorId: 'a', sourceId: 'missing', code: 'OTRA_COPIA', name: 'X' }),
    ).rejects.toBeInstanceOf(ResponseScaleNotFoundError);
    await expect(
      build().execute({ actorId: 'a', sourceId: 'source_1', code: 'EVIDENCE_4', name: 'X' }),
    ).rejects.toBeInstanceOf(ResponseScaleCodeAlreadyExistsError);
    expect(await prisma.responseScale.count()).toBe(1);
    expect(await prisma.auditLog.count({ where: { entity: 'ResponseScale' } })).toBe(0);
  }, 15_000);

  it('lets exactly one of 8 simultaneous duplicates with the same code win', async () => {
    await seedSource();
    const useCase = build();

    const results = await Promise.allSettled(
      Array.from({ length: 8 }, (_, index) =>
        useCase.execute({
          actorId: `admin_${index}`,
          sourceId: 'source_1',
          code: 'EVIDENCE_4_V2',
          name: `Copia ${index}`,
        }),
      ),
    );

    const losers = results.filter(
      (result): result is PromiseRejectedResult => result.status === 'rejected',
    );
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(losers).toHaveLength(7);
    for (const loser of losers) {
      expect(loser.reason).toBeInstanceOf(ResponseScaleCodeAlreadyExistsError);
    }
    expect(await prisma.responseScale.count({ where: { code: 'EVIDENCE_4_V2' } })).toBe(1);
    expect(await prisma.scaleLevel.count()).toBe(6);
    expect(await prisma.auditLog.count({ where: { entity: 'ResponseScale' } })).toBe(1);
    await expectValidAuditChain();
  }, 15_000);

  it('rolls back the copy when the audit fails', async () => {
    await seedSource();
    const failingAudit: AuditLogger = {
      log: async () => {
        throw new Error('audit failed');
      },
    };

    await expect(
      build(failingAudit).execute({
        actorId: 'admin_1',
        sourceId: 'source_1',
        code: 'EVIDENCE_4_V2',
        name: 'Copia',
      }),
    ).rejects.toThrow('audit failed');

    expect(await prisma.responseScale.count()).toBe(1);
    expect(await prisma.scaleLevel.count()).toBe(3);
  }, 15_000);
});
