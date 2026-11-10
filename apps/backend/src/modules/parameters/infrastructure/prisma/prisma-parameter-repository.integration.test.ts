import { describe, expect, it, vi } from 'vitest';
import { PrismaUnitOfWork } from '../../../../shared/prisma/prisma-unit-of-work.js';
import { useTestDatabase } from '../../../../test/db/use-test-database.js';
import { Parameter } from '../../domain/entities/parameter.js';
import { ParameterConflictError } from '../../domain/errors/index.js';
import { PrismaParameterRepository } from './prisma-parameter-repository.js';

describe('PrismaParameterRepository Integration (PostgreSQL real, T-011-18)', () => {
  const { getPrisma } = useTestDatabase();
  const prisma = getPrisma();
  const uow = new PrismaUnitOfWork(prisma);
  const repository = new PrismaParameterRepository(uow);

  async function createSemester(code: string, startDate: string, endDate: string) {
    return prisma.semester.create({
      data: {
        code,
        startDate: new Date(`${startDate}T00:00:00.000Z`),
        endDate: new Date(`${endDate}T00:00:00.000Z`),
      },
    });
  }

  function parameter(
    id: string,
    key: string,
    value: number,
    effectiveFromSemesterId: string | null,
  ): Parameter {
    return Parameter.create({
      id,
      key,
      value,
      effectiveFromSemesterId,
      createdBy: 'admin-1',
      updatedBy: 'admin-1',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  it('saves and lists versions ordered by key and effective date, defaults first', async () => {
    const s1 = await createSemester('2027-I', '2027-03-01', '2027-07-31');
    const s2 = await createSemester('2027-II', '2027-08-01', '2027-12-31');

    await repository.save(parameter('p_meta_2', 'META_AG', 85, s2.id));
    await repository.save(parameter('p_umbral', 'UMBRAL_LOGRADO', 14, null));
    await repository.save(parameter('p_meta_0', 'META_AG', 70, null));
    await repository.save(parameter('p_meta_1', 'META_AG', 80, s1.id));

    const versions = await repository.listVersions();
    expect(
      versions.map((v) => [
        v.parameter.key,
        v.parameter.value,
        v.semesterCode,
        v.semesterStartDate,
      ]),
    ).toEqual([
      ['META_AG', 70, null, null],
      ['META_AG', 80, '2027-I', '2027-03-01'],
      ['META_AG', 85, '2027-II', '2027-08-01'],
      ['UMBRAL_LOGRADO', 14, null, null],
    ]);
  }, 15_000);

  it('replaces the value of an existing (key, semester) version', async () => {
    const s1 = await createSemester('2027-I', '2027-03-01', '2027-07-31');
    await repository.save(parameter('p_1', 'META_AG', 80, s1.id));
    await repository.save(parameter('p_other_id', 'META_AG', 90, s1.id));

    const versions = await repository.listVersions();
    expect(versions).toHaveLength(1);
    expect(versions[0]?.parameter.id).toBe('p_1');
    expect(versions[0]?.parameter.value).toBe(90);
  }, 15_000);

  it('replaces the default value without creating a second default', async () => {
    await repository.save(parameter('p_1', 'META_AG', 70, null));
    await repository.save(parameter('p_2', 'META_AG', 75, null));

    const versions = await repository.listVersions();
    expect(versions).toHaveLength(1);
    expect(versions[0]?.parameter.value).toBe(75);
  }, 15_000);

  it('rejects a second default value for the same key through the partial unique index', async () => {
    await prisma.parameter.create({ data: { id: 'raw_1', key: 'META_AG', value: 70 } });
    await expect(
      prisma.parameter.create({ data: { id: 'raw_2', key: 'META_AG', value: 71 } }),
    ).rejects.toMatchObject({ code: 'P2002' });
  }, 15_000);

  it('rejects the same (key, semester) through the unique index', async () => {
    const s1 = await createSemester('2027-I', '2027-03-01', '2027-07-31');
    await prisma.parameter.create({
      data: { id: 'raw_1', key: 'META_AG', value: 70, effectiveFromSemesterId: s1.id },
    });
    await expect(
      prisma.parameter.create({
        data: { id: 'raw_2', key: 'META_AG', value: 71, effectiveFromSemesterId: s1.id },
      }),
    ).rejects.toMatchObject({ code: 'P2002' });
  }, 15_000);

  it('translates a unique violation on insert into ParameterConflictError', async () => {
    const s1 = await createSemester('2027-I', '2027-03-01', '2027-07-31');
    // Simula una carrera: la fila aparece entre la búsqueda y la inserción.
    await prisma.parameter.create({
      data: { id: 'raw_1', key: 'META_AG', value: 70, effectiveFromSemesterId: s1.id },
    });
    const racing = new PrismaParameterRepository({
      get: () =>
        ({
          parameter: {
            findFirst: () => Promise.resolve(null),
            create: prisma.parameter.create.bind(prisma.parameter),
            update: prisma.parameter.update.bind(prisma.parameter),
          },
        }) as unknown as ReturnType<typeof uow.get>,
    });

    await expect(racing.save(parameter('p_2', 'META_AG', 80, s1.id))).rejects.toBeInstanceOf(
      ParameterConflictError,
    );
  }, 15_000);

  it('rejects out-of-range values and malformed keys through CHECK constraints', async () => {
    await expect(
      prisma.parameter.create({ data: { id: 'raw_neg', key: 'META_AG', value: -1 } }),
    ).rejects.toThrow();
    await expect(
      prisma.parameter.create({ data: { id: 'raw_key', key: 'meta_ag', value: 1 } }),
    ).rejects.toThrow();
  }, 15_000);

  it('restricts deleting a semester that has parameter versions', async () => {
    const s1 = await createSemester('2027-I', '2027-03-01', '2027-07-31');
    await repository.save(parameter('p_1', 'META_AG', 80, s1.id));
    await expect(prisma.semester.delete({ where: { id: s1.id } })).rejects.toThrow();
  }, 15_000);

  it('fails lockAndListVersions outside a transaction', async () => {
    await expect(repository.lockAndListVersions()).rejects.toThrow(/transacción activa/);
  }, 15_000);

  it('lists inside a transaction after taking the lock', async () => {
    await repository.save(parameter('p_1', 'META_AG', 70, null));
    const versions = await uow.run(() => repository.lockAndListVersions());
    expect(versions).toHaveLength(1);
  }, 15_000);

  it('serializes two transactions through the table lock', async () => {
    const order: string[] = [];
    let releaseFirst: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    let firstHasLock: () => void = () => undefined;
    const firstLocked = new Promise<void>((resolve) => {
      firstHasLock = resolve;
    });

    const first = uow.run(async () => {
      await repository.lockAndListVersions();
      order.push('first-locked');
      firstHasLock();
      await gate;
      await repository.save(parameter('p_first', 'META_AG', 70, null));
      order.push('first-saved');
    });

    await firstLocked;
    const second = uow.run(async () => {
      const seen = await repository.lockAndListVersions();
      order.push(`second-locked-seeing-${seen.length}`);
    });
    // El segundo queda esperando el bloqueo mientras el primero lo conserva.
    await vi.waitFor(
      async () => {
        const waiting = await prisma.$queryRaw<{ count: bigint }[]>`
          SELECT count(*) AS count FROM pg_locks l
          JOIN pg_class c ON c.oid = l.relation
          WHERE c.relname = 'parameters' AND NOT l.granted`;
        expect(Number(waiting[0]?.count)).toBeGreaterThan(0);
      },
      { timeout: 10_000, interval: 50 },
    );
    expect(order).toEqual(['first-locked']);
    releaseFirst();
    await Promise.all([first, second]);

    expect(order).toEqual(['first-locked', 'first-saved', 'second-locked-seeing-1']);
  }, 15_000);
});
