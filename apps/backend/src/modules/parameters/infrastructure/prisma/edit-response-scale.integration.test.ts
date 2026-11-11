import { describe, expect, it } from 'vitest';
import { AuditChainVerifier } from '../../../../shared/audit/audit-chain-verifier.js';
import type { AuditLogger } from '../../../../shared/audit/audit-logger.js';
import { PrismaAuditChainReader } from '../../../../shared/prisma/prisma-audit-chain-reader.js';
import { PrismaAuditLogger } from '../../../../shared/prisma/prisma-audit-logger.js';
import { PrismaUnitOfWork } from '../../../../shared/prisma/prisma-unit-of-work.js';
import { useTestDatabase } from '../../../../test/db/use-test-database.js';
import { EditResponseScaleUseCase } from '../../application/edit-response-scale.js';
import { ResponseScaleInUseError } from '../../domain/errors/index.js';
import type { ParametersPermissionChecker } from '../../domain/ports/parameters-permission-checker.js';
import type { ScaleUsageReader } from '../../domain/ports/scale-usage-reader.js';
import { NeverUsedScaleUsageReader } from '../never-used-scale-usage-reader.js';
import { PrismaResponseScaleRepository } from './prisma-response-scale-repository.js';
import { PrismaScaleLevelRepository } from './prisma-scale-level-repository.js';

describe('EditResponseScaleUseCase Integration (PostgreSQL real, T-012-07, CA3)', () => {
  const { getPrisma } = useTestDatabase();
  const prisma = getPrisma();
  const uow = new PrismaUnitOfWork(prisma);
  const scaleRepository = new PrismaResponseScaleRepository(uow);
  const levelRepository = new PrismaScaleLevelRepository(uow);
  const permissionChecker: ParametersPermissionChecker = { assertAllowed: async () => {} };

  function build(
    scaleUsageReader: ScaleUsageReader = new NeverUsedScaleUsageReader(),
    auditLogger: AuditLogger = new PrismaAuditLogger(uow),
  ) {
    return new EditResponseScaleUseCase({
      scaleRepository,
      levelRepository,
      scaleUsageReader,
      permissionChecker,
      unitOfWork: uow,
      auditLogger,
    });
  }

  async function seedScale() {
    await prisma.responseScale.create({
      data: {
        id: 'scale_1',
        code: 'LIKERT_5',
        name: 'Likert 5',
        type: 'LIKERT',
        levels: {
          create: [
            { order: 1, label: 'Bajo', value: 1, countsAsAchievement: false },
            { order: 2, label: 'Medio', value: 2, countsAsAchievement: false },
            { order: 3, label: 'Alto', value: 3, countsAsAchievement: true },
          ],
        },
      },
    });
  }

  async function currentLevels() {
    const rows = await prisma.scaleLevel.findMany({
      where: { scaleId: 'scale_1' },
      orderBy: { order: 'asc' },
    });
    return rows.map((row) => [row.order, row.label, row.value, row.countsAsAchievement]);
  }

  async function expectValidAuditChain(): Promise<void> {
    const verifier = new AuditChainVerifier(new PrismaAuditChainReader(uow));
    expect((await verifier.verify()).valid).toBe(true);
  }

  it('renames and replaces the levels, auditing before and after in one event', async () => {
    await seedScale();

    const dto = await build().execute({
      actorId: 'admin_1',
      id: 'scale_1',
      name: 'Likert 2',
      levels: [
        { label: 'No', value: 0, countsAsAchievement: false },
        { label: 'Sí', value: 100, countsAsAchievement: true },
      ],
    });

    expect(dto).toMatchObject({ name: 'Likert 2', inUse: false });
    expect(await currentLevels()).toEqual([
      [1, 'No', 0, false],
      [2, 'Sí', 100, true],
    ]);
    const events = await prisma.auditLog.findMany({ where: { entity: 'ResponseScale' } });
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ action: 'UPDATE', entityId: 'scale_1' });
    expect((events[0]?.before as { levels: unknown[] }).levels).toHaveLength(3);
    expect((events[0]?.after as { levels: unknown[] }).levels).toHaveLength(2);
    await expectValidAuditChain();
  }, 15_000);

  it('changes only the name when levels are not sent', async () => {
    await seedScale();

    await build().execute({ actorId: 'admin_1', id: 'scale_1', name: 'Solo nombre' });

    expect((await prisma.responseScale.findUniqueOrThrow({ where: { id: 'scale_1' } })).name).toBe(
      'Solo nombre',
    );
    expect(await currentLevels()).toHaveLength(3);
  }, 15_000);

  it('neither writes nor audits when the values are identical (D18)', async () => {
    await seedScale();

    await build().execute({
      actorId: 'admin_1',
      id: 'scale_1',
      name: 'Likert 5',
      levels: [
        { label: 'Bajo', value: 1, countsAsAchievement: false },
        { label: 'Medio', value: 2, countsAsAchievement: false },
        { label: 'Alto', value: 3, countsAsAchievement: true },
      ],
    });

    expect(await prisma.auditLog.count({ where: { entity: 'ResponseScale' } })).toBe(0);
    expect(await currentLevels()).toHaveLength(3);
  }, 15_000);

  it('serializes 8 simultaneous edits and leaves one consistent level set', async () => {
    await seedScale();
    const useCase = build();
    const sets = Array.from({ length: 8 }, (_, index) => {
      const size = 2 + (index % 4);
      return Array.from({ length: size }, (__, position) => ({
        label: `Edición ${index} nivel ${position}`,
        value: index * 10 + position,
        countsAsAchievement: position === size - 1,
      }));
    });

    const results = await Promise.allSettled(
      sets.map((levels, index) =>
        useCase.execute({ actorId: `admin_${index}`, id: 'scale_1', levels }),
      ),
    );

    expect(results.every((result) => result.status === 'fulfilled')).toBe(true);
    const finalLevels = await currentLevels();
    const orders = finalLevels.map((level) => level[0]);
    expect(orders).toEqual(orders.map((_, position) => position + 1));
    const matching = sets.filter(
      (levels) =>
        JSON.stringify(
          levels.map((level, position) => [
            position + 1,
            level.label,
            level.value,
            level.countsAsAchievement,
          ]),
        ) === JSON.stringify(finalLevels),
    );
    expect(matching).toHaveLength(1);
    expect(await prisma.auditLog.count({ where: { entity: 'ResponseScale' } })).toBe(8);
    await expectValidAuditChain();
  }, 15_000);

  it('rejects every simultaneous edit when the scale is in use', async () => {
    await seedScale();
    const inUse: ScaleUsageReader = { isInUse: async () => true };
    const useCase = build(inUse);

    const results = await Promise.allSettled(
      Array.from({ length: 8 }, (_, index) =>
        useCase.execute({ actorId: 'admin_1', id: 'scale_1', name: `Nombre ${index}` }),
      ),
    );

    for (const result of results) {
      expect(result.status).toBe('rejected');
      expect((result as PromiseRejectedResult).reason).toBeInstanceOf(ResponseScaleInUseError);
    }
    expect((await prisma.responseScale.findUniqueOrThrow({ where: { id: 'scale_1' } })).name).toBe(
      'Likert 5',
    );
    expect(await currentLevels()).toHaveLength(3);
    expect(await prisma.auditLog.count({ where: { entity: 'ResponseScale' } })).toBe(0);
  }, 15_000);

  it('rolls back the new levels when the audit fails', async () => {
    await seedScale();
    const failingAudit: AuditLogger = {
      log: async () => {
        throw new Error('audit failed');
      },
    };

    await expect(
      build(new NeverUsedScaleUsageReader(), failingAudit).execute({
        actorId: 'admin_1',
        id: 'scale_1',
        name: 'Cambiada',
        levels: [
          { label: 'A', value: 1, countsAsAchievement: false },
          { label: 'B', value: 2, countsAsAchievement: true },
        ],
      }),
    ).rejects.toThrow('audit failed');

    expect((await prisma.responseScale.findUniqueOrThrow({ where: { id: 'scale_1' } })).name).toBe(
      'Likert 5',
    );
    expect(await currentLevels()).toEqual([
      [1, 'Bajo', 1, false],
      [2, 'Medio', 2, false],
      [3, 'Alto', 3, true],
    ]);
  }, 15_000);
});
