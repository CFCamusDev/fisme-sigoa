import { describe, expect, it } from 'vitest';
import { AuditChainVerifier } from '../../../../shared/audit/audit-chain-verifier.js';
import type { AuditLogger } from '../../../../shared/audit/audit-logger.js';
import { PrismaAuditChainReader } from '../../../../shared/prisma/prisma-audit-chain-reader.js';
import { PrismaAuditLogger } from '../../../../shared/prisma/prisma-audit-logger.js';
import { PrismaUnitOfWork } from '../../../../shared/prisma/prisma-unit-of-work.js';
import { useTestDatabase } from '../../../../test/db/use-test-database.js';
import { CreateResponseScaleUseCase } from '../../application/create-response-scale.js';
import { ResponseScaleCodeAlreadyExistsError } from '../../domain/errors/index.js';
import type { ParametersPermissionChecker } from '../../domain/ports/parameters-permission-checker.js';
import { PrismaResponseScaleRepository } from './prisma-response-scale-repository.js';
import { PrismaScaleLevelRepository } from './prisma-scale-level-repository.js';

describe('CreateResponseScaleUseCase Integration (PostgreSQL real, T-012-06, RF-012)', () => {
  const { getPrisma } = useTestDatabase();
  const prisma = getPrisma();
  const uow = new PrismaUnitOfWork(prisma);
  const scaleRepository = new PrismaResponseScaleRepository(uow);
  const levelRepository = new PrismaScaleLevelRepository(uow);
  const permissionChecker: ParametersPermissionChecker = { assertAllowed: async () => {} };

  function build(auditLogger: AuditLogger = new PrismaAuditLogger(uow)) {
    return new CreateResponseScaleUseCase({
      scaleReader: scaleRepository,
      scaleRepository,
      levelRepository,
      permissionChecker,
      unitOfWork: uow,
      auditLogger,
    });
  }

  const command = (code: string, actorId = 'admin_1') => ({
    actorId,
    code,
    name: `Escala ${code}`,
    type: 'EVIDENCE' as const,
    levels: [
      { label: 'No se evidencia', value: 1, countsAsAchievement: false },
      { label: 'Se evidencia totalmente', value: 2, countsAsAchievement: true },
    ],
  });

  async function expectValidAuditChain(): Promise<void> {
    const verifier = new AuditChainVerifier(new PrismaAuditChainReader(uow));
    expect((await verifier.verify()).valid).toBe(true);
  }

  it('creates the scale, its levels and one audit event', async () => {
    const dto = await build().execute({ ...command('EVIDENCE_4'), ip: '127.0.0.1' });

    expect(dto).toMatchObject({ code: 'EVIDENCE_4', type: 'EVIDENCE', inUse: false });
    const rows = await prisma.scaleLevel.findMany({
      where: { scaleId: dto.id },
      orderBy: { order: 'asc' },
    });
    expect(rows.map((row) => [row.order, row.label, row.countsAsAchievement])).toEqual([
      [1, 'No se evidencia', false],
      [2, 'Se evidencia totalmente', true],
    ]);

    const events = await prisma.auditLog.findMany({ where: { entity: 'ResponseScale' } });
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ action: 'CREATE', entityId: dto.id, actor: 'admin_1' });
    expect(events[0]?.before).toBeNull();
    expect(events[0]?.after).toMatchObject({ code: 'EVIDENCE_4' });
    await expectValidAuditChain();
  }, 15_000);

  it('rejects a repeated code without writing anything new', async () => {
    await build().execute(command('EVIDENCE_4'));

    await expect(build().execute(command('EVIDENCE_4'))).rejects.toBeInstanceOf(
      ResponseScaleCodeAlreadyExistsError,
    );
    expect(await prisma.responseScale.count()).toBe(1);
    expect(await prisma.auditLog.count({ where: { entity: 'ResponseScale' } })).toBe(1);
  }, 15_000);

  it('lets exactly one of 8 simultaneous creations with the same code win', async () => {
    const useCase = build();

    const results = await Promise.allSettled(
      Array.from({ length: 8 }, (_, index) =>
        useCase.execute(command('LIKERT_5', `admin_${index}`)),
      ),
    );

    const winners = results.filter((result) => result.status === 'fulfilled');
    const losers = results.filter(
      (result): result is PromiseRejectedResult => result.status === 'rejected',
    );
    expect(winners).toHaveLength(1);
    expect(losers).toHaveLength(7);
    for (const loser of losers) {
      expect(loser.reason).toBeInstanceOf(ResponseScaleCodeAlreadyExistsError);
    }
    expect(await prisma.responseScale.count({ where: { code: 'LIKERT_5' } })).toBe(1);
    expect(await prisma.scaleLevel.count()).toBe(2);
    expect(await prisma.auditLog.count({ where: { entity: 'ResponseScale' } })).toBe(1);
    await expectValidAuditChain();
  }, 15_000);

  it('creates scales with different codes simultaneously without losing any', async () => {
    const useCase = build();
    const codes = ['SCALE_A', 'SCALE_B', 'SCALE_C', 'SCALE_D'];

    const results = await Promise.allSettled(codes.map((code) => useCase.execute(command(code))));

    expect(results.every((result) => result.status === 'fulfilled')).toBe(true);
    expect(await prisma.responseScale.count()).toBe(4);
    expect(await prisma.scaleLevel.count()).toBe(8);
    expect(await prisma.auditLog.count({ where: { entity: 'ResponseScale' } })).toBe(4);
    await expectValidAuditChain();
  }, 15_000);

  it('rolls back the header and the levels when the audit fails', async () => {
    const failingAudit: AuditLogger = {
      log: async () => {
        throw new Error('audit failed');
      },
    };

    await expect(build(failingAudit).execute(command('EVIDENCE_4'))).rejects.toThrow(
      'audit failed',
    );

    expect(await prisma.responseScale.count()).toBe(0);
    expect(await prisma.scaleLevel.count()).toBe(0);
    expect(await prisma.auditLog.count({ where: { entity: 'ResponseScale' } })).toBe(0);
  }, 15_000);
});
