import { describe, expect, it } from 'vitest';
import { PrismaAuditChainReader } from '../../../../shared/prisma/prisma-audit-chain-reader.js';
import { PrismaAuditLogger } from '../../../../shared/prisma/prisma-audit-logger.js';
import { PrismaUnitOfWork } from '../../../../shared/prisma/prisma-unit-of-work.js';
import { AuditChainVerifier } from '../../../../shared/audit/audit-chain-verifier.js';
import { useTestDatabase } from '../../../../test/db/use-test-database.js';
import { DefineParametersUseCase } from '../../application/define-parameters.js';
import { PARAMETER_CATALOG, PARAMETER_KEYS } from '../../domain/policies/parameter-catalog.js';
import type { ParametersPermissionChecker } from '../../domain/ports/parameters-permission-checker.js';
import { ParameterResolver } from '../../domain/services/parameter-resolver.js';
import { PrismaParameterRepository } from './prisma-parameter-repository.js';
import { PrismaSemesterRepository } from './prisma-semester-repository.js';

describe('DefineParametersUseCase Concurrency Integration (PostgreSQL real, T-011-05, CA2, CA3)', () => {
  const { getPrisma } = useTestDatabase();
  const prisma = getPrisma();
  const uow = new PrismaUnitOfWork(prisma);
  const parameterRepository = new PrismaParameterRepository(uow);
  const semesterRepository = new PrismaSemesterRepository(uow);
  const permissionChecker: ParametersPermissionChecker = { assertAllowed: async () => {} };

  const useCase = new DefineParametersUseCase({
    parameterRepository,
    semesterReader: semesterRepository,
    permissionChecker,
    unitOfWork: uow,
    auditLogger: new PrismaAuditLogger(uow),
  });

  async function seedDefaults(): Promise<void> {
    await prisma.parameter.createMany({
      data: PARAMETER_KEYS.map((key) => ({
        key,
        value: PARAMETER_CATALOG[key].defaultValue,
        createdBy: 'SEED',
        updatedBy: 'SEED',
      })),
    });
  }

  async function createSemester(code: string, startDate: string, endDate: string) {
    return prisma.semester.create({
      data: {
        code,
        startDate: new Date(`${startDate}T00:00:00.000Z`),
        endDate: new Date(`${endDate}T00:00:00.000Z`),
      },
    });
  }

  async function expectValidAuditChain(): Promise<void> {
    const verifier = new AuditChainVerifier(new PrismaAuditChainReader(uow));
    expect((await verifier.verify()).valid).toBe(true);
  }

  it('serializes 20 simultaneous definitions of the same key and semester into one row', async () => {
    await seedDefaults();
    const semester = await createSemester('2027-I', '2027-03-01', '2027-07-31');

    const results = await Promise.allSettled(
      Array.from({ length: 20 }, (_, index) =>
        useCase.execute({
          semesterCode: '2027-I',
          values: [{ key: 'UMBRAL_LOGRADO', value: index }],
          actorId: `admin_${index + 1}`,
        }),
      ),
    );

    expect(results.every((r) => r.status === 'fulfilled')).toBe(true);
    const rows = await prisma.parameter.findMany({
      where: { key: 'UMBRAL_LOGRADO', effectiveFromSemesterId: semester.id },
    });
    expect(rows).toHaveLength(1);

    const events = await prisma.auditLog.findMany({
      where: { entity: 'Parameter', action: 'PARAMETER_CHANGE' },
      orderBy: { sequence: 'asc' },
    });
    // Un valor idéntico al vigente en esa versión no genera evento: 19 o 20 según el orden.
    expect(events.length).toBeGreaterThanOrEqual(19);
    expect(events.length).toBeLessThanOrEqual(20);
    const last = events[events.length - 1]?.after as { value: number } | null;
    expect(last?.value).toBe(rows[0]?.value);
    // Cada evento encadena: el `before` de uno es el `after` del anterior (excepto el alta).
    expect(events[0]?.before ?? null).toBeNull();
    for (let i = 1; i < events.length; i += 1) {
      const before = events[i]?.before as { value: number } | null;
      const previousAfter = events[i - 1]?.after as { value: number } | null;
      expect(before?.value).toBe(previousAfter?.value);
    }
    await expectValidAuditChain();
  }, 15_000);

  it('never leaves weights different from 100 under simultaneous pair updates', async () => {
    await seedDefaults();
    await createSemester('2027-I', '2027-03-01', '2027-07-31');

    const pairs = [
      [60, 40],
      [50, 50],
      [80, 20],
      [30, 70],
    ] as const;
    const results = await Promise.allSettled(
      Array.from({ length: 20 }, (_, index) => {
        const [direct, indirect] = pairs[index % pairs.length] ?? [70, 30];
        return useCase.execute({
          semesterCode: '2027-I',
          values: [
            { key: 'PESO_DIRECTA', value: direct },
            { key: 'PESO_INDIRECTA', value: indirect },
          ],
          actorId: 'admin_1',
        });
      }),
    );

    expect(results.every((r) => r.status === 'fulfilled')).toBe(true);
    const direct = await prisma.parameter.findFirstOrThrow({
      where: { key: 'PESO_DIRECTA', effectiveFromSemesterId: { not: null } },
    });
    const indirect = await prisma.parameter.findFirstOrThrow({
      where: { key: 'PESO_INDIRECTA', effectiveFromSemesterId: { not: null } },
    });
    expect(direct.value + indirect.value).toBe(100);
    await expectValidAuditChain();
  }, 15_000);

  it('creates versions for different semesters simultaneously without losing any', async () => {
    await seedDefaults();
    const codes = ['2027-I', '2027-II', '2028-I', '2028-II'];
    await createSemester('2027-I', '2027-03-01', '2027-07-31');
    await createSemester('2027-II', '2027-08-01', '2027-12-31');
    await createSemester('2028-I', '2028-03-01', '2028-07-31');
    await createSemester('2028-II', '2028-08-01', '2028-12-31');

    const results = await Promise.allSettled(
      codes.map((code, index) =>
        useCase.execute({
          semesterCode: code,
          values: [{ key: 'META_AG', value: 71 + index }],
          actorId: 'admin_1',
        }),
      ),
    );

    expect(results.every((r) => r.status === 'fulfilled')).toBe(true);
    expect(await prisma.parameter.count({ where: { key: 'META_AG' } })).toBe(5);
    expect(await prisma.auditLog.count({ where: { action: 'PARAMETER_CHANGE' } })).toBe(4);
    await expectValidAuditChain();
  }, 15_000);

  it('keeps earlier semesters resolving to the old value', async () => {
    await seedDefaults();
    await createSemester('2026-II', '2026-08-01', '2026-12-31');
    await createSemester('2027-I', '2027-03-01', '2027-07-31');

    await useCase.execute({
      semesterCode: '2027-I',
      values: [{ key: 'UMBRAL_LOGRADO', value: 15 }],
      actorId: 'admin_1',
    });

    const resolver = new ParameterResolver({
      parameterReader: parameterRepository,
      semesterReader: semesterRepository,
    });
    await expect(resolver.resolve('UMBRAL_LOGRADO', '2026-II')).resolves.toBe(14);
    await expect(resolver.resolve('UMBRAL_LOGRADO', '2027-I')).resolves.toBe(15);
  }, 15_000);

  it('rolls back every change when the request is rejected', async () => {
    await seedDefaults();
    await createSemester('2027-I', '2027-03-01', '2027-07-31');

    await expect(
      useCase.execute({
        semesterCode: '2027-I',
        values: [
          { key: 'UMBRAL_LOGRADO', value: 16 },
          { key: 'PESO_DIRECTA', value: 70 },
        ],
        actorId: 'admin_1',
      }),
    ).rejects.toThrow();

    expect(await prisma.parameter.count()).toBe(7);
    expect(await prisma.auditLog.count({ where: { action: 'PARAMETER_CHANGE' } })).toBe(0);
  }, 15_000);
});
